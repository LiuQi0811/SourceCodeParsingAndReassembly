#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
16k.club 全站爬虫 - 支持自动解密、多线程、断点续传
支持功能：
1. 全站小说分类抓取
2. 自动检测并解密各类反爬（字体/JS/AES/CSS伪元素等）
3. 多线程并发下载
4. 断点续传
5. 自动保存为TXT/EPUB格式
6. 请求重试和代理支持
"""

import os
import re
import sys
import time
import json
import random
import threading
from queue import Queue
from urllib.parse import urljoin, urlparse
from typing import Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm
from fake_useragent import UserAgent

from decryptor import ContentDecryptor


class NovelCrawler:
    """小说全站爬虫"""

    def __init__(self, base_url: str = "https://16k.club", max_workers: int = 5,
                 delay: float = 1.0, output_dir: str = "novels"):
        self.base_url = base_url.rstrip('/')
        self.max_workers = max_workers
        self.delay = delay
        self.output_dir = output_dir
        self.domain = urlparse(base_url).netloc

        # 创建输出目录
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs(os.path.join(output_dir, "cache"), exist_ok=True)

        # 初始化会话
        self.session = requests.Session()
        self.ua = UserAgent()
        self._update_headers()

        # 初始化解密器
        self.decryptor = ContentDecryptor()

        # 线程锁
        self.lock = threading.Lock()
        self.visited_urls = set()
        self.novel_list = []
        self.failed_urls = []

        # 加载进度
        self.progress_file = os.path.join(output_dir, "crawl_progress.json")
        self._load_progress()

        # 配置请求重试
        self.max_retries = 3

    def _update_headers(self):
        """更新请求头，模拟浏览器"""
        self.session.headers.update({
            'User-Agent': self.ua.random,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': self.base_url + '/',
            'Cache-Control': 'max-age=0',
        })

    def _load_progress(self):
        """加载爬取进度"""
        if os.path.exists(self.progress_file):
            try:
                with open(self.progress_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.visited_urls = set(data.get('visited', []))
                    self.novel_list = data.get('novels', [])
                    print(f"[*] 加载进度：已访问 {len(self.visited_urls)} 个页面，发现 {len(self.novel_list)} 本小说")
            except Exception as e:
                print(f"[!] 进度加载失败: {e}")

    def _save_progress(self):
        """保存爬取进度"""
        with self.lock:
            try:
                with open(self.progress_file, 'w', encoding='utf-8') as f:
                    json.dump({
                        'visited': list(self.visited_urls),
                        'novels': self.novel_list,
                        'timestamp': time.time()
                    }, f, ensure_ascii=False, indent=2)
            except Exception as e:
                print(f"[!] 进度保存失败: {e}")

    def request(self, url: str, method: str = 'get', **kwargs) -> requests.Response:
        """发送HTTP请求，带重试和延迟"""
        for attempt in range(self.max_retries):
            try:
                time.sleep(self.delay + random.random() * 0.5)
                self._update_headers()

                response = self.session.request(
                    method, url, timeout=30, allow_redirects=True, **kwargs
                )
                response.raise_for_status()

                # 自动检测编码
                if response.encoding == 'ISO-8859-1':
                    response.encoding = response.apparent_encoding or 'utf-8'

                return response

            except Exception as e:
                if attempt == self.max_retries - 1:
                    print(f"[!] 请求失败 {url}: {e}")
                    self.failed_urls.append(url)
                    raise
                time.sleep(2 ** attempt)

    def detect_page_type(self, url: str, html: str) -> str:
        """检测页面类型：首页/分类/小说详情/章节内容/其他"""
        soup = BeautifulSoup(html, 'lxml')
        path = urlparse(url).path

        # 首页
        if path in ['', '/', '/index.html', '/index.htm']:
            return 'home'

        # 章节内容页（通常包含大量中文文本和阅读相关标识）
        chapter_indicators = ['div#content', 'div#chaptercontent', 'div.read-content',
                              'div[class*="content"]', 'div[class*="chapter"]']
        for indicator in chapter_indicators:
            if soup.select(indicator):
                content_div = soup.select_one(indicator)
                if content_div and len(content_div.get_text(strip=True)) > 200:
                    # 检查是否包含较多中文
                    text = content_div.get_text()
                    chinese_count = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
                    if chinese_count > 100:
                        return 'chapter'

        # 小说详情页（包含作者、简介、章节列表）
        if soup.find('meta', property='og:type', content='novel') or \
                any(keyword in html for keyword in ['作者：', '简介', '最新章节', '章节目录', '小说分类']):
            return 'novel_detail'

        # 分类页/列表页
        list_indicators = ['/list/', '/sort/', '/category/', '/fenlei/', '/xiaoshuo/']
        if any(ind in path for ind in list_indicators) or \
                soup.find('div', class_=re.compile(r'list|book-list|novel-list')):
            return 'list'

        return 'other'

    def extract_novel_info(self, url: str, html: str) -> dict:
        """提取小说详情页信息"""
        soup = BeautifulSoup(html, 'lxml')
        novel_info = {
            'url': url,
            'title': '',
            'author': '',
            'category': '',
            'status': '',
            'description': '',
            'cover': '',
            'chapters': [],
            'last_update': '',
        }

        # 标题
        title_selectors = ['h1', 'h2', 'div.novel-title', 'div.book-title', 'h1.title']
        for selector in title_selectors:
            elem = soup.select_one(selector)
            if elem:
                novel_info['title'] = elem.get_text(strip=True)
                break

        # 如果没找到标题，尝试用title标签
        if not novel_info['title']:
            title_tag = soup.find('title')
            if title_tag:
                title_text = title_tag.get_text(strip=True)
                novel_info['title'] = re.split(r'_|-\s*|最新章节|免费阅读|笔趣阁|16k', title_text)[0].strip()

        # 作者
        author_patterns = [
            r'作\s*者[：:]\s*<[^>]*>([^<]+)',
            r'作\s*者[：:]\s*([^\s<]+)',
            r'<span[^>]*>作者</span>\s*<[^>]*>([^<]+)',
        ]
        for pattern in author_patterns:
            match = re.search(pattern, html)
            if match:
                novel_info['author'] = match.group(1).strip()
                break

        # 分类
        category_patterns = [
            r'分\s*类[：:]\s*<[^>]*>([^<]+)',
            r'分\s*类[：:]\s*([^\s<]+)',
        ]
        for pattern in category_patterns:
            match = re.search(pattern, html)
            if match:
                novel_info['category'] = match.group(1).strip()
                break

        # 状态（连载/完结）
        if any(keyword in html for keyword in ['完结', '已完成', '完本']):
            novel_info['status'] = '完结'
        elif any(keyword in html for keyword in ['连载', '连载中', '更新中']):
            novel_info['status'] = '连载'

        # 简介
        desc_selectors = ['div#intro', 'div.intro', 'div.description', 'div.novel-info p',
                         'div.book-info p', 'div.synopsis']
        for selector in desc_selectors:
            elem = soup.select_one(selector)
            if elem and len(elem.get_text(strip=True)) > 20:
                novel_info['description'] = elem.get_text(strip=True)[:500]
                break

        # 封面
        cover_selectors = ['div#fmimg img', 'div.book-img img', 'div.novel-cover img',
                          'div.cover img', 'meta[property="og:image"]']
        for selector in cover_selectors:
            elem = soup.select_one(selector)
            if elem:
                cover_url = elem.get('src') or elem.get('content')
                if cover_url:
                    novel_info['cover'] = urljoin(url, cover_url)
                break

        # 章节列表
        chapter_list_selectors = ['div#list dd a', 'div.chapter-list a', 'ul.section-list a',
                                  'div.listmain dd a', 'div.book-chapter a']
        chapters = []
        for selector in chapter_list_selectors:
            chapter_links = soup.select(selector)
            if chapter_links:
                for a in chapter_links:
                    chapter_title = a.get_text(strip=True)
                    chapter_url = a.get('href', '')
                    if chapter_url and chapter_title and not chapter_title.startswith('javascript'):
                        chapter_url = urljoin(url, chapter_url)
                        # 过滤非章节链接
                        if any(kw in chapter_title for kw in ['章', '节', '第', '卷', '篇']) or \
                                re.search(r'\d+\.html?$', chapter_url):
                            chapters.append({
                                'title': chapter_title,
                                'url': chapter_url,
                                'downloaded': False
                            })
                break

        # 如果上面没找到，尝试找所有在章节列表区域的链接
        if not chapters:
            list_div = soup.find('div', id=re.compile(r'list|chapter', re.I))
            if list_div:
                for a in list_div.find_all('a', href=True):
                    href = a['href']
                    title = a.get_text(strip=True)
                    if title and href and not href.startswith('javascript'):
                        chapters.append({
                            'title': title,
                            'url': urljoin(url, href),
                            'downloaded': False
                        })

        novel_info['chapters'] = chapters

        # 去重章节
        seen_urls = set()
        unique_chapters = []
        for ch in chapters:
            if ch['url'] not in seen_urls:
                seen_urls.add(ch['url'])
                unique_chapters.append(ch)
        novel_info['chapters'] = unique_chapters

        return novel_info

    def extract_chapter_content(self, url: str, html: str) -> Tuple[str, str]:
        """提取并解密章节内容"""
        # 检测加密方式
        encryption_info = self.decryptor.detect_encryption(html)

        # 提取标题
        soup = BeautifulSoup(html, 'lxml')
        title = ""
        title_selectors = ['h1', 'h2', 'div.chapter-title', 'h1.title', 'div.bookname h1']
        for selector in title_selectors:
            elem = soup.select_one(selector)
            if elem:
                title = elem.get_text(strip=True)
                break

        # 提取内容区域
        content = ""
        content_selectors = [
            'div#content', 'div#chaptercontent', 'div#BookText', 'div#htmlContent',
            'div.content', 'div.chapter-content', 'div.read-content', 'div#booktext',
            'div.txtcontent', 'div#contents', 'div#text', 'div.novel-content',
            'td[valign="top"]', 'div#TXT', 'div.content_read'
        ]

        for selector in content_selectors:
            elem = soup.select_one(selector)
            if elem:
                content_html = str(elem)
                # 解密内容
                content = self.decryptor.decrypt_chapter_content(
                    content_html, encryption_info, self.session, self.base_url,
                    dict(self.session.headers)
                )
                # 验证内容有效性
                chinese_count = sum(1 for c in content if '\u4e00' <= c <= '\u9fff')
                if chinese_count > 100:
                    break
                content = ""

        # 如果都没找到，尝试提取body中的主要文本
        if not content:
            body = soup.find('body')
            if body:
                # 移除导航、侧边栏等无关元素
                for elem in body.find_all(['script', 'style', 'nav', 'footer', 'header', 'aside']):
                    elem.decompose()
                for elem in body.find_all('div', class_=re.compile(r'nav|header|footer|sidebar|menu|ad|comment')):
                    elem.decompose()

                content_html = str(body)
                content = self.decryptor.decrypt_chapter_content(content_html, encryption_info)

        return title, content.strip()

    def extract_links(self, url: str, html: str) -> list:
        """提取页面中的所有站内链接"""
        soup = BeautifulSoup(html, 'lxml')
        links = []

        for a in soup.find_all('a', href=True):
            href = a['href']
            if href.startswith('javascript') or href.startswith('#') or href.startswith('mailto:'):
                continue

            # 转为绝对URL
            absolute_url = urljoin(url, href)
            parsed = urlparse(absolute_url)

            # 只处理同域名链接
            if parsed.netloc == self.domain or parsed.netloc.endswith(self.domain):
                # 过滤静态资源
                if not any(ext in parsed.path.lower() for ext in [
                    '.jpg', '.jpeg', '.png', '.gif', '.css', '.js', '.ico',
                    '.woff', '.woff2', '.ttf', '.svg', '.pdf', '.zip'
                ]):
                    # 规范化URL
                    clean_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
                    if parsed.query:
                        clean_url += f"?{parsed.query}"
                    links.append(clean_url)

        return list(set(links))

    def download_novel(self, novel_info: dict) -> bool:
        """下载一本小说的所有章节"""
        title = novel_info.get('title', '未知小说')
        if not title:
            return False

        # 安全文件名
        safe_title = re.sub(r'[<>:"/\\|?*]', '_', title)
        novel_dir = os.path.join(self.output_dir, safe_title)
        os.makedirs(novel_dir, exist_ok=True)

        # 小说信息文件
        info_file = os.path.join(novel_dir, 'info.json')
        if os.path.exists(info_file):
            try:
                with open(info_file, 'r', encoding='utf-8') as f:
                    novel_info = json.load(f)
            except:
                pass

        # 创建TXT文件
        txt_file = os.path.join(novel_dir, f'{safe_title}.txt')
        chapters = novel_info.get('chapters', [])

        if not chapters:
            print(f"[!] 小说《{title}》没有找到章节列表")
            return False

        print(f"\n[*] 开始下载《{title}》，共 {len(chapters)} 章")

        # 检查已下载的章节
        downloaded_count = sum(1 for ch in chapters if ch.get('downloaded'))
        if downloaded_count == len(chapters):
            print(f"[✓] 《{title}》已全部下载完成")
            return True

        # 多线程下载章节
        success_count = downloaded_count
        fail_chapters = []

        # 创建章节队列
        chapter_queue = Queue()
        for i, chapter in enumerate(chapters):
            if not chapter.get('downloaded'):
                chapter_queue.put((i, chapter))

        def download_chapter_worker():
            nonlocal success_count
            while not chapter_queue.empty():
                try:
                    idx, chapter = chapter_queue.get(timeout=1)
                except:
                    break

                chapter_url = chapter['url']
                chapter_title = chapter['title']

                try:
                    response = self.request(chapter_url)
                    ch_title, content = self.extract_chapter_content(chapter_url, response.text)

                    if content and len(content) > 100:
                        # 保存单章文件（便于断点续传）
                        ch_file = os.path.join(novel_dir, f'chapter_{idx:05d}.txt')
                        with open(ch_file, 'w', encoding='utf-8') as f:
                            f.write(f"{chapter_title}\n\n{content}\n")

                        chapters[idx]['downloaded'] = True
                        chapters[idx]['content_length'] = len(content)
                        with self.lock:
                            success_count += 1
                    else:
                        fail_chapters.append(chapter_title)

                except Exception as e:
                    print(f"[!] 章节下载失败: {chapter_title} - {e}")
                    fail_chapters.append(chapter_title)
                finally:
                    chapter_queue.task_done()

        # 启动线程池
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(download_chapter_worker) for _ in range(self.max_workers)]
            for future in as_completed(futures):
                future.result()

        # 合并所有章节到TXT
        print(f"[*] 正在合并章节到TXT文件...")
        with open(txt_file, 'w', encoding='utf-8') as out_f:
            # 写入小说信息
            out_f.write(f"书名：{title}\n")
            out_f.write(f"作者：{novel_info.get('author', '未知')}\n")
            out_f.write(f"分类：{novel_info.get('category', '未知')}\n")
            out_f.write(f"状态：{novel_info.get('status', '未知')}\n")
            if novel_info.get('description'):
                out_f.write(f"\n简介：{novel_info['description']}\n")
            out_f.write("\n" + "=" * 50 + "\n\n")

            # 按顺序写入章节
            for i, chapter in enumerate(chapters):
                ch_file = os.path.join(novel_dir, f'chapter_{i:05d}.txt')
                if os.path.exists(ch_file):
                    with open(ch_file, 'r', encoding='utf-8') as in_f:
                        out_f.write(in_f.read())
                        out_f.write("\n\n" + "=" * 30 + "\n\n")

        # 保存小说信息
        novel_info['chapters'] = chapters
        novel_info['download_complete'] = (len(fail_chapters) == 0)
        novel_info['txt_file'] = txt_file
        with open(info_file, 'w', encoding='utf-8') as f:
            json.dump(novel_info, f, ensure_ascii=False, indent=2)

        print(f"[✓] 《{title}》下载完成: 成功 {success_count}/{len(chapters)} 章")
        if fail_chapters:
            print(f"[!] 失败章节: {len(fail_chapters)} 章")

        return len(fail_chapters) == 0

    def crawl_site(self, start_url: str = None, max_novels: int = None,
                   max_pages: int = None, download_content: bool = True):
        """
        全站爬取
        :param start_url: 起始URL，默认首页
        :param max_novels: 最多抓取多少本小说（None为不限制）
        :param max_pages: 最多抓取多少个页面（None为不限制）
        :param download_content: 是否下载小说内容
        """
        if start_url is None:
            start_url = self.base_url

        url_queue = Queue()
        url_queue.put(start_url)
        self.visited_urls.add(start_url)

        page_count = 0
        novel_count = 0
        start_time = time.time()

        print(f"[*] 开始爬取网站: {self.base_url}")
        print(f"[*] 配置: 线程数={self.max_workers}, 请求延迟={self.delay}s")

        # BFS遍历网站
        try:
            with tqdm(desc="爬取页面", unit="页") as pbar:
                while not url_queue.empty():
                    # 检查限制
                    if max_pages and page_count >= max_pages:
                        print(f"[*] 达到最大页面数限制: {max_pages}")
                        break
                    if max_novels and novel_count >= max_novels:
                        print(f"[*] 达到最大小说数限制: {max_novels}")
                        break

                    current_url = url_queue.get()
                    page_count += 1

                    try:
                        response = self.request(current_url)
                        html = response.text

                        page_type = self.detect_page_type(current_url, html)

                        # 提取链接
                        links = self.extract_links(current_url, html)
                        for link in links:
                            if link not in self.visited_urls:
                                with self.lock:
                                    if link not in self.visited_urls:
                                        self.visited_urls.add(link)
                                        url_queue.put(link)

                        # 处理小说详情页
                        if page_type == 'novel_detail':
                            novel_info = self.extract_novel_info(current_url, html)
                            if novel_info.get('title') and len(novel_info.get('chapters', [])) > 0:
                                # 检查是否已存在
                                exists = any(n['url'] == current_url for n in self.novel_list)
                                if not exists:
                                    self.novel_list.append(novel_info)
                                    novel_count += 1

                                    tqdm.write(f"[+] 发现小说: 《{novel_info['title']}》 - {novel_info['author']} - {len(novel_info['chapters'])}章")

                                    # 立即下载小说内容
                                    if download_content:
                                        self.download_novel(novel_info)

                        pbar.update(1)

                        # 定期保存进度
                        if page_count % 20 == 0:
                            self._save_progress()
                            pbar.set_postfix({
                                '发现小说': novel_count,
                                '队列大小': url_queue.qsize()
                            })

                    except Exception as e:
                        tqdm.write(f"[!] 处理页面失败 {current_url}: {e}")
                    finally:
                        url_queue.task_done()

        except KeyboardInterrupt:
            print("\n[!] 用户中断爬取")

        # 保存最终进度
        self._save_progress()

        # 保存小说列表
        novels_list_file = os.path.join(self.output_dir, '全部小说列表.json')
        with open(novels_list_file, 'w', encoding='utf-8') as f:
            json.dump(self.novel_list, f, ensure_ascii=False, indent=2)

        elapsed = time.time() - start_time
        print(f"\n[✓] 爬取完成!")
        print(f"    总页面数: {page_count}")
        print(f"    发现小说: {novel_count} 本")
        print(f"    失败URL: {len(self.failed_urls)} 个")
        print(f"    耗时: {elapsed:.1f} 秒")
        print(f"    输出目录: {os.path.abspath(self.output_dir)}")
        print(f"    小说列表: {novels_list_file}")

    def crawl_single_novel(self, novel_url: str):
        """爬取单本小说"""
        print(f"[*] 开始爬取单本小说: {novel_url}")
        response = self.request(novel_url)
        novel_info = self.extract_novel_info(novel_url, response.text)

        if not novel_info.get('title'):
            print("[!] 未能识别小说信息")
            return None

        print(f"[*] 小说: 《{novel_info['title']}》")
        print(f"    作者: {novel_info.get('author', '未知')}")
        print(f"    分类: {novel_info.get('category', '未知')}")
        print(f"    章节数: {len(novel_info.get('chapters', []))}")

        self.download_novel(novel_info)
        return novel_info

    def crawl_category(self, category_url: str, max_novels: int = None):
        """爬取分类下的所有小说"""
        print(f"[*] 开始爬取分类: {category_url}")
        novels_found = []
        page = 1

        while True:
            url = category_url
            if page > 1:
                if '?' in category_url:
                    url = f"{category_url}&page={page}"
                else:
                    url = f"{category_url}?page={page}"

            try:
                response = self.request(url)
                soup = BeautifulSoup(response.text, 'lxml')

                # 提取小说链接
                novel_links = []
                for a in soup.find_all('a', href=True):
                    href = a['href']
                    text = a.get_text(strip=True)
                    if text and len(text) > 1 and (re.search(r'/book/\d+', href) or
                                                    re.search(r'/\d+_\d+', href) or
                                                    re.search(r'/xiaoshuo/\d+', href)):
                        absolute_url = urljoin(url, href)
                        if absolute_url not in [n['url'] for n in novels_found]:
                            novel_links.append(absolute_url)

                if not novel_links:
                    break

                for novel_url in novel_links:
                    if max_novels and len(novels_found) >= max_novels:
                        break

                    try:
                        novel_resp = self.request(novel_url)
                        novel_info = self.extract_novel_info(novel_url, novel_resp.text)
                        if novel_info.get('title') and len(novel_info.get('chapters', [])) > 0:
                            novels_found.append(novel_info)
                            print(f"[+] ({len(novels_found)}) 《{novel_info['title']}》 - {novel_info['author']}")
                            self.download_novel(novel_info)
                    except Exception as e:
                        print(f"[!] 获取小说信息失败: {novel_url} - {e}")

                if max_novels and len(novels_found) >= max_novels:
                    break

                page += 1

            except Exception as e:
                print(f"[!] 分类页访问失败: {url} - {e}")
                break

        return novels_found


def main():
    import argparse

    parser = argparse.ArgumentParser(description='16k.club 全站小说爬虫（支持自动解密）')
    parser.add_argument('-u', '--url', default='https://16k.club', help='网站首页地址')
    parser.add_argument('-o', '--output', default='novels', help='输出目录')
    parser.add_argument('-t', '--threads', type=int, default=5, help='并发线程数')
    parser.add_argument('-d', '--delay', type=float, default=1.0, help='请求延迟（秒）')
    parser.add_argument('--novel', type=str, help='爬取单本小说的URL')
    parser.add_argument('--category', type=str, help='爬取分类页面URL')
    parser.add_argument('--max-novels', type=int, help='最多抓取小说数量')
    parser.add_argument('--max-pages', type=int, help='最多抓取页面数量')
    parser.add_argument('--no-download', action='store_true', help='仅发现小说，不下载内容')
    parser.add_argument('--list-only', action='store_true', help='仅列出小说，不下载')

    args = parser.parse_args()

    print("=" * 60)
    print("16k.club 全站爬虫 - 支持自动解密反爬内容")
    print("=" * 60)

    crawler = NovelCrawler(
        base_url=args.url,
        max_workers=args.threads,
        delay=args.delay,
        output_dir=args.output
    )

    try:
        if args.novel:
            # 单本小说模式
            crawler.crawl_single_novel(args.novel)
        elif args.category:
            # 分类爬取模式
            crawler.crawl_category(args.category, args.max_novels)
        else:
            # 全站爬取模式
            crawler.crawl_site(
                max_novels=args.max_novels,
                max_pages=args.max_pages,
                download_content=not args.no_download and not args.list_only
            )
    except KeyboardInterrupt:
        print("\n[!] 用户中断程序")
    except Exception as e:
        print(f"\n[!] 程序出错: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
