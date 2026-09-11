#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
幻梦ACG轻小说全站爬虫 (https://www.huanmengacg.com/)
功能：自动爬取全站小说、章节列表、正文内容，保存为TXT文件
特点：
- 无需解密，纯HTML解析（服务端渲染）
- 自动处理反爬（UA+Referer+Session）
- 断点续传（已爬取的自动跳过）
- 限速防封
- 错误重试
- 自动清理广告
"""

import requests
from bs4 import BeautifulSoup
import os
import re
import time
import json
from urllib.parse import urljoin, urlparse
import logging
from datetime import datetime
import sys
import random

# ==================== 配置 ====================
BASE_URL = "https://www.huanmengacg.com"
SAVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "novels")
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "spider.log")
PROGRESS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "progress.json")

# 爬取配置
MAX_PAGES = 0  # 0=爬取全部列表页, 例如设置5则只爬前5页
MAX_RETRY = 3  # 失败重试次数
DELAY_MIN = 1.0  # 请求最小间隔(秒)
DELAY_MAX = 2.5  # 请求最大间隔(秒)
TIMEOUT = 20  # 请求超时(秒)

# ==================== 日志配置 ====================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# ==================== 请求会话 ====================
def create_session():
    """创建带有伪装头的请求会话"""
    session = requests.Session()
    # 移动端UA - 经测试必须使用移动端UA才能正常获取正文
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0',
    })
    return session

def safe_request(session, url, referer=None, retry=MAX_RETRY):
    """安全的请求封装，带重试和延时"""
    headers = {}
    if referer:
        headers['Referer'] = referer
    
    for i in range(retry):
        try:
            # 随机延时
            time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
            
            resp = session.get(url, headers=headers, timeout=TIMEOUT)
            resp.encoding = 'utf-8'  # 强制UTF-8编码
            
            if resp.status_code == 200:
                # 检测是否被反爬拦截
                if '书籍下架' in resp.text and len(resp.text) < 5000:
                    logger.warning(f"可能被反爬拦截({url})，重试 {i+1}/{retry}")
                    time.sleep(2 ** i)  # 指数退避
                    continue
                return resp
            elif resp.status_code == 404:
                logger.warning(f"页面不存在: {url}")
                return None
            else:
                logger.warning(f"HTTP {resp.status_code}: {url}, 重试 {i+1}/{retry}")
                time.sleep(2 ** i)
        except Exception as e:
            logger.warning(f"请求异常: {url}, 错误: {e}, 重试 {i+1}/{retry}")
            time.sleep(2 ** i)
    
    logger.error(f"请求失败: {url}")
    return None

# ==================== 文件名清理 ====================
def clean_filename(name):
    """清理非法文件名字符"""
    if not name:
        return "未知"
    # 移除Windows/Linux非法字符
    name = re.sub(r'[\\/:*?"<>|\r\n\t]', '_', name)
    # 移除首尾空格和点
    name = name.strip('. ')
    # 限制长度
    if len(name) > 100:
        name = name[:100]
    return name or "未知"

# ==================== 进度管理 ====================
def load_progress():
    """加载断点续传进度"""
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            pass
    return {
        'books': {},      # {book_id: {'title': xxx, 'chapters': {chapter_id: True}}}
        'list_pages_done': [],  # 已爬取的列表页
        'last_update': ''
    }

def save_progress(progress):
    """保存进度"""
    progress['last_update'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)

# ==================== 解析功能 ====================
def parse_book_list_page(html):
    """解析小说列表页，提取小说信息和链接"""
    soup = BeautifulSoup(html, 'html.parser')
    books = []
    
    # 匹配小说详情链接: /index.php/book/info/{id}
    book_links = soup.find_all('a', href=re.compile(r'/index\.php/book/info/\d+'))
    
    seen_ids = set()
    for link in book_links:
        href = link.get('href', '')
        match = re.search(r'/book/info/(\d+)', href)
        if not match:
            continue
        book_id = match.group(1)
        if book_id in seen_ids:
            continue
        seen_ids.add(book_id)
        
        # 书名在dt标签内
        dt_tag = link.find('dt')
        if dt_tag:
            title = dt_tag.get_text(strip=True)
        else:
            # fallback: 使用img的alt属性
            img_tag = link.find('img')
            if img_tag and img_tag.get('alt'):
                title = img_tag.get('alt', '').strip()
            else:
                # 最后fallback: 在"简介"处截断文本
                raw_text = link.get_text(strip=True)
                title = re.split(r'简介[：:]?', raw_text, maxsplit=1)[0].strip()
        
        if not title or len(title) < 2:
            title = f'小说_{book_id}'
        
        full_url = urljoin(BASE_URL, href)
        books.append({
            'id': book_id,
            'title': title,
            'url': full_url
        })
    
    # 获取最大页码
    max_page = 1
    page_links = soup.find_all('a', href=re.compile(r'/book/category(?:/(\d+))?\.html'))
    for p in page_links:
        href = p.get('href', '')
        m = re.search(r'/category/(\d+)\.html', href)
        if m:
            page_num = int(m.group(1))
            max_page = max(max_page, page_num)
    # 检查是否有"225"这种直接页码
    page_texts = re.findall(r'>(\d+)<', html)
    for pt in page_texts:
        try:
            num = int(pt)
            if num < 1000:
                max_page = max(max_page, num)
        except:
            pass
    
    return books, max_page

def parse_book_info(html):
    """解析小说详情页，提取小说元信息和章节列表"""
    soup = BeautifulSoup(html, 'html.parser')
    
    # 书名 - h1标签
    title_tag = soup.find('h1')
    if not title_tag:
        title_tag = soup.find('h2')
    title = title_tag.get_text(strip=True) if title_tag else '未知小说'
    
    # 作者 - 尝试多种方式获取
    author = '未知'
    # 方法1: 查找author-link
    author_link = soup.find('a', class_='author-link')
    if author_link:
        author = author_link.get_text(strip=True)
    # 方法2: 查找class含author的元素
    if author == '未知':
        author_el = soup.find(class_=re.compile(r'author', re.I))
        if author_el:
            author_text = author_el.get_text(strip=True)
            author_text = re.sub(r'^作者[：:]?\s*', '', author_text)
            if author_text and len(author_text) < 30:
                author = author_text
    # 方法3: 正则匹配
    if author == '未知':
        author_match = re.search(r'作者[：:]\s*([^\s<]+)', html)
        if author_match:
            author = author_match.group(1)
    
    # 简介
    intro = ''
    intro_div = soup.find('dd', class_='book-profile') or soup.find('div', class_=re.compile(r'intro|desc|summary', re.I))
    if intro_div:
        intro = intro_div.get_text(strip=True)
    
    # 提取所有章节链接
    chapters = []
    # 阅读链接格式: /index.php/book_read_{bookId}_{chapterId}.html
    chapter_links = soup.find_all('a', href=re.compile(r'/index\.php/book_read_\d+_\d+\.html'))
    
    seen_ch = set()  # 用chapter_id去重
    for link in chapter_links:
        href = link.get('href', '')
        match = re.search(r'book_read_(\d+)_(\d+)\.html', href)
        if not match:
            continue
        book_id = match.group(1)
        chapter_id = match.group(2)
        
        ch_title = link.get_text(strip=True)
        # 跳过"立即阅读"按钮（它是跳转链接，不是真正的章节列表项）
        if ch_title in ('立即阅读', '开始阅读', '点击阅读'):
            continue
        
        # 按chapter_id去重（同一章节只保留第一次出现，通常是最新章节在顶部重复）
        if chapter_id in seen_ch:
            continue
        seen_ch.add(chapter_id)
        
        if not ch_title:
            ch_title = f'第{len(chapters)+1}章'
        
        full_url = urljoin(BASE_URL, href)
        chapters.append({
            'id': chapter_id,
            'book_id': book_id,
            'title': ch_title,
            'url': full_url
        })
    
    return {
        'title': title,
        'author': author,
        'intro': intro,
        'chapters': chapters
    }

def clean_chapter_content(html):
    """解析并清洗章节正文内容"""
    soup = BeautifulSoup(html, 'html.parser')
    
    # 查找正文容器 - 优先使用id=BookText(chaptercontent)
    content_div = soup.find('div', id='BookText')
    if not content_div:
        content_div = soup.find('div', class_='chaptercontent')
    if not content_div:
        content_div = soup.find('div', id='content')
    if not content_div:
        return None
    
    # 提取章节标题
    ch_title = ''
    title_tag = soup.find('h2') or soup.find('h1')
    if title_tag:
        ch_title = title_tag.get_text(strip=True)
    
    # 移除不需要的元素
    for tag in content_div.find_all(['script', 'style', 'iframe', 'ins']):
        tag.decompose()
    
    # 移除广告和导航元素
    for tag in content_div.find_all(['div', 'p']):
        text = tag.get_text(strip=True)
        ad_patterns = [
            r'http[s]?://',
            r'本文来自',
            r'幻梦轻小说',
            r'书源.*报废',
            r'风月AI',
            r'APP下载',
            r'公告',
            r'上一章',
            r'下一章',
            r'返回目录',
            r'加入书签',
            r'书籍下架',
            r'版权问题',
        ]
        for pat in ad_patterns:
            if re.search(pat, text):
                tag.decompose()
                break
    
    # 获取纯文本
    text = content_div.get_text('\n', strip=True)
    
    # 二次清理: 逐行过滤
    lines = []
    ad_lines = [
        '---------', '————', '———', '------',
        '幻梦轻小说', '本文来自', 'http', 'www.huanmeng',
        '书源', 'APP', '风月', '公告', '下架', '版权'
    ]
    for line in text.split('\n'):
        line = line.strip()
        line = re.sub(r'\s+', ' ', line)  # 合并空白
        if not line:
            continue
        if any(ad in line for ad in ad_lines):
            continue
        # 太短的行可能是残余广告
        if len(line) <= 2 and not re.search(r'[\u4e00-\u9fa5]{2,}', line):
            continue
        lines.append(line)
    
    # 合并段落，每段之间空行
    clean_text = '\n\n'.join(lines)
    
    return ch_title, clean_text

# ==================== 核心爬取逻辑 ====================
def crawl_chapter(session, chapter, save_path, book_referer):
    """爬取单个章节"""
    ch_id = chapter['id']
    ch_title = chapter['title']
    ch_url = chapter['url']
    
    # 检查是否已爬取 (通过文件中是否存在该章节标题)
    if os.path.exists(save_path):
        with open(save_path, 'r', encoding='utf-8') as f:
            content = f.read()
        if ch_title in content:
            logger.debug(f"  [跳过] 已存在: {ch_title}")
            return True
    
    resp = safe_request(session, ch_url, referer=book_referer)
    if not resp:
        return False
    
    title, text = clean_chapter_content(resp.text)
    if not text or len(text) < 50:
        logger.warning(f"  [警告] 内容过短可能被拦截: {ch_title}")
        return False
    
    # 追加写入文件
    with open(save_path, 'a', encoding='utf-8') as f:
        f.write(f'\n\n{"="*50}\n')
        f.write(f'【{ch_title}】\n')
        f.write(f'{"="*50}\n\n')
        f.write(text)
        f.write('\n')
    
    logger.info(f"  [成功] {ch_title} ({len(text)}字)")
    return True

def crawl_book(session, book_info, progress):
    """爬取单本小说的所有章节"""
    book_id = book_info['id']
    book_title = book_info['title']
    
    logger.info(f"\n{'='*60}")
    logger.info(f"开始爬取: 《{book_title}》 (ID:{book_id})")
    logger.info(f"{'='*60}")
    
    # 请求详情页
    resp = safe_request(session, book_info['url'])
    if not resp:
        logger.error(f"无法访问小说详情页: {book_title}")
        return False
    
    info = parse_book_info(resp.text)
    
    # 用页面解析到的书名更准确
    if info['title'] and len(info['title']) > 2:
        book_title = info['title']
    
    # 创建保存目录
    book_dir = os.path.join(SAVE_DIR, clean_filename(book_title))
    os.makedirs(book_dir, exist_ok=True)
    
    # TXT文件路径
    txt_path = os.path.join(book_dir, f'{clean_filename(book_title)}.txt')
    
    # 如果是新书，写入元信息头
    if not os.path.exists(txt_path):
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(f'书名：{book_title}\n')
            f.write(f'作者：{info["author"]}\n')
            f.write(f'来源：幻梦ACG (https://www.huanmengacg.com/)\n')
            f.write(f'爬取时间：{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n')
            if info['intro']:
                f.write(f'\n简介：\n{info["intro"]}\n')
            f.write(f'\n{"#"*60}\n\n')
    
    chapters = info['chapters']
    logger.info(f"共发现 {len(chapters)} 个章节")
    
    # 爬取每个章节
    success_count = 0
    fail_count = 0
    
    for idx, ch in enumerate(chapters, 1):
        logger.info(f"[{idx}/{len(chapters)}] ", extra={})
        if crawl_chapter(session, ch, txt_path, book_info['url']):
            success_count += 1
        else:
            fail_count += 1
            # 失败时保存进度
            if book_id not in progress['books']:
                progress['books'][book_id] = {'title': book_title, 'failed_chapters': []}
            progress['books'][book_id]['failed_chapters'] = progress['books'][book_id].get('failed_chapters', [])
            progress['books'][book_id]['failed_chapters'].append(ch['id'])
            save_progress(progress)
    
    logger.info(f"《{book_title}》爬取完成! 成功:{success_count}, 失败:{fail_count}")
    
    # 保存进度
    progress['books'][book_id] = {
        'title': book_title,
        'chapters_count': len(chapters),
        'success': success_count,
        'failed': fail_count,
        'path': txt_path,
        'completed': fail_count == 0
    }
    save_progress(progress)
    
    return True

def get_total_pages(session):
    """获取列表总页数"""
    resp = safe_request(session, f'{BASE_URL}/index.php/book/category/')
    if not resp:
        return 1
    _, max_page = parse_book_list_page(resp.text)
    return max_page

def crawl_all_lists(session, progress):
    """爬取所有小说列表"""
    all_books = []
    
    # 获取总页数
    total_pages = get_total_pages(session)
    if MAX_PAGES > 0:
        total_pages = min(total_pages, MAX_PAGES)
    logger.info(f"小说列表总页数: {total_pages}")
    
    for page in range(1, total_pages + 1):
        if page in progress['list_pages_done']:
            logger.info(f"[列表页 {page}/{total_pages}] 已爬取，跳过")
            # 仍然需要获取该页的书籍列表
            if page == 1:
                url = f'{BASE_URL}/index.php/book/category/'
            else:
                url = f'{BASE_URL}/index.php/book/category/{page}.html'
            resp = safe_request(session, url)
            if resp:
                books, _ = parse_book_list_page(resp.text)
                all_books.extend(books)
            continue
        
        logger.info(f"[列表页 {page}/{total_pages}] 正在爬取...")
        
        if page == 1:
            url = f'{BASE_URL}/index.php/book/category/'
        else:
            url = f'{BASE_URL}/index.php/book/category/{page}.html'
        
        resp = safe_request(session, url)
        if not resp:
            logger.error(f"列表页 {page} 访问失败")
            continue
        
        books, _ = parse_book_list_page(resp.text)
        logger.info(f"  发现 {len(books)} 本小说")
        all_books.extend(books)
        
        # 标记该页已完成
        progress['list_pages_done'].append(page)
        save_progress(progress)
    
    return all_books

# ==================== 主函数 ====================
def main():
    logger.info("="*60)
    logger.info("幻梦ACG轻小说全站爬虫启动")
    logger.info(f"保存目录: {SAVE_DIR}")
    logger.info(f"启动时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("="*60)
    
    os.makedirs(SAVE_DIR, exist_ok=True)
    
    # 加载进度
    progress = load_progress()
    logger.info(f"已加载进度: 已完成 {len(progress['books'])} 本小说, {len(progress['list_pages_done'])} 个列表页")
    
    # 创建会话
    session = create_session()
    
    # 先访问首页建立Cookie
    logger.info("初始化会话...")
    safe_request(session, BASE_URL)
    
    # 爬取小说列表
    logger.info("\n开始获取小说列表...")
    all_books = crawl_all_lists(session, progress)
    
    # 去重
    unique_books = {}
    for b in all_books:
        unique_books[b['id']] = b
    all_books = list(unique_books.values())
    
    logger.info(f"\n总计发现 {len(all_books)} 本小说")
    
    # 爬取每本小说
    success_books = 0
    fail_books = 0
    skip_books = 0
    
    for idx, book in enumerate(all_books, 1):
        book_id = book['id']
        
        # 检查是否已完整爬取
        if book_id in progress['books'] and progress['books'][book_id].get('completed', False):
            logger.info(f"[{idx}/{len(all_books)}] 《{book['title']}》已完成，跳过")
            skip_books += 1
            continue
        
        logger.info(f"\n[{idx}/{len(all_books)}]")
        try:
            if crawl_book(session, book, progress):
                success_books += 1
            else:
                fail_books += 1
        except KeyboardInterrupt:
            logger.info("\n用户中断，保存进度...")
            save_progress(progress)
            logger.info("进度已保存，下次运行可断点续传")
            sys.exit(0)
        except Exception as e:
            logger.error(f"爬取《{book['title']}》时发生异常: {e}", exc_info=True)
            fail_books += 1
        
        # 每爬完一本保存一次进度
        save_progress(progress)
    
    # 最终统计
    logger.info("\n" + "="*60)
    logger.info("爬取任务完成!")
    logger.info(f"总小说数: {len(all_books)}")
    logger.info(f"本次成功: {success_books}")
    logger.info(f"本次失败: {fail_books}")
    logger.info(f"已跳过(之前完成): {skip_books}")
    logger.info(f"保存位置: {SAVE_DIR}")
    logger.info(f"完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("="*60)

if __name__ == '__main__':
    main()
