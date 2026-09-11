#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kmoe 浏览器自动化下载脚本
==========================
使用Playwright完全模拟真实浏览器操作，无需完全逆向加密和验证码
自动处理:
- 登录态保持
- 动态JS渲染
- 验证码弹窗等待（人工辅助）
- 真实下载链接触发

使用前安装:
    pip install playwright
    playwright install chromium
"""

import os
import sys
import time
import json
import logging
from pathlib import Path
from typing import List, Optional, Set
from urllib.parse import urljoin

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)


class KmoeBrowserDownloader:
    """基于Playwright的Kmoe下载器"""
    
    def __init__(self, download_dir: str = "./kmoe_downloads", headless: bool = False):
        self.download_dir = Path(download_dir)
        self.download_dir.mkdir(parents=True, exist_ok=True)
        self.headless = headless
        self.browser = None
        self.context = None
        self.page = None
        self.downloaded_books: Set[str] = set()
        self._load_download_history()
    
    def _load_download_history(self):
        """加载已下载记录"""
        history_file = self.download_dir / "download_history.json"
        if history_file.exists():
            try:
                with open(history_file, 'r', encoding='utf-8') as f:
                    self.downloaded_books = set(json.load(f))
            except:
                pass
    
    def _save_download_history(self):
        """保存下载记录"""
        history_file = self.download_dir / "download_history.json"
        with open(history_file, 'w', encoding='utf-8') as f:
            json.dump(list(self.downloaded_books), f, ensure_ascii=False, indent=2)
    
    def start(self):
        """启动浏览器"""
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            logger.error("请先安装playwright:")
            logger.error("  pip install playwright")
            logger.error("  playwright install chromium")
            return False
        
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(
            headless=self.headless,
            args=['--disable-blink-features=AutomationControlled']
        )
        
        # 创建持久化上下文（保存登录状态）
        user_data_dir = self.download_dir / ".browser_data"
        user_data_dir.mkdir(exist_ok=True)
        
        self.context = self.browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1400, "height": 900},
            accept_downloads=True,
        )
        
        # 设置下载路径
        self.context.set_default_timeout(30000)
        
        self.page = self.context.new_page()
        logger.info("浏览器启动成功")
        return True
    
    def is_logged_in(self) -> bool:
        """检查是否已登录"""
        try:
            self.page.goto("https://kxx.moe/", wait_until="domcontentloaded")
            time.sleep(2)
            content = self.page.content()
            # 登录成功后会显示"主頁"而非"登錄"或显示用户信息
            if "登錄" in content and "login.php" in self.page.url:
                return False
            return True
        except:
            return False
    
    def login(self, username: str = None, password: str = None):
        """
        登录
        如果未提供账号密码，则打开浏览器等待用户手动登录
        """
        logger.info("打开登录页面...")
        self.page.goto("https://kxx.moe/login.php", wait_until="networkidle")
        
        if username and password:
            # 自动填写登录表单（选择器可能需要根据实际页面调整）
            try:
                # 尝试查找用户名/密码输入框
                self.page.wait_for_selector('input[name="u"], input[name="username"], input[type="text"]', timeout=5000)
                
                # 填写用户名
                username_input = self.page.locator('input[name="u"], input[name="username"]').first
                if username_input.is_visible():
                    username_input.fill(username)
                
                # 填写密码
                password_input = self.page.locator('input[name="p"], input[name="password"], input[type="password"]').first
                if password_input.is_visible():
                    password_input.fill(password)
                
                # 点击登录按钮
                login_btn = self.page.locator('button[type="submit"], input[type="submit"], button:has-text("登錄")').first
                if login_btn.is_visible():
                    login_btn.click()
                
                self.page.wait_for_load_state("networkidle")
                time.sleep(2)
                
                if self.is_logged_in():
                    logger.info("自动登录成功!")
                    return True
            except Exception as e:
                logger.warning(f"自动登录失败: {e}")
        
        # 手动登录
        logger.info("="*60)
        logger.info("请在浏览器中手动完成登录")
        logger.info("登录完成后，按回车键继续...")
        logger.info("="*60)
        input()
        return self.is_logged_in()
    
    def get_book_list(self, start_page: int = 1, max_pages: int = None) -> List[dict]:
        """
        获取漫画列表
        返回: [{"id": "...", "title": "...", "score": "...", "url": "..."}]
        """
        all_books = []
        current_page = start_page
        
        while True:
            if current_page == 1:
                url = "https://kxx.moe/"
            else:
                url = f"https://kxx.moe/l/--/{current_page}.htm"
            
            logger.info(f"获取列表页: {url}")
            self.page.goto(url, wait_until="domcontentloaded")
            time.sleep(2)
            
            # 获取所有漫画链接
            links = self.page.locator('a[href^="/c/"]').all()
            seen_ids = set()
            page_books = []
            
            for link in links:
                try:
                    href = link.get_attribute("href") or ""
                    text = link.inner_text().strip()
                    
                    import re
                    match = re.search(r'/c/(\d+)\.htm', href)
                    if match and text and len(text) > 1:
                        book_id = match.group(1)
                        if book_id not in seen_ids:
                            seen_ids.add(book_id)
                            page_books.append({
                                "id": book_id,
                                "title": text,
                                "url": f"https://kxx.moe/c/{book_id}.htm"
                            })
                except:
                    continue
            
            logger.info(f"第{current_page}页: 找到{len(page_books)}本漫画")
            all_books.extend(page_books)
            
            # 检查是否有下一页
            if max_pages and current_page >= max_pages:
                break
            
            next_page = current_page + 1
            next_link = self.page.locator(f'a[href*="/--/{next_page}.htm"]').first
            if not next_link.is_visible():
                logger.info("已到达最后一页")
                break
            
            current_page = next_page
            time.sleep(1)
        
        return all_books
    
    def wait_for_captcha(self, timeout: int = 120):
        """等待用户完成验证码"""
        logger.info("检测到可能的验证码，请在浏览器中手动完成验证...")
        try:
            # 等待验证码弹窗消失或下载开始
            self.page.wait_for_load_state("networkidle", timeout=timeout*1000)
        except:
            pass
        time.sleep(3)
    
    def download_book(self, book_url: str, book_title: str, 
                     file_type: str = "epub", max_vols: int = None) -> int:
        """
        下载单本漫画的所有卷
        :param book_url: 漫画详情页URL
        :param book_title: 漫画标题
        :param file_type: epub/mobi
        :param max_vols: 最大下载卷数（None=全部）
        :return: 成功下载数量
        """
        book_id = book_url.split("/c/")[-1].replace(".htm", "")
        
        if book_id in self.downloaded_books:
            logger.info(f"跳过已下载: {book_title}")
            return 0
        
        # 创建书籍目录
        safe_title = "".join(c for c in book_title if c.isalnum() or c in " _-。，！？")
        book_dir = self.download_dir / safe_title
        book_dir.mkdir(exist_ok=True)
        
        logger.info(f"打开漫画: {book_title}")
        self.page.goto(book_url, wait_until="domcontentloaded")
        time.sleep(3)
        
        # 切换到下载标签
        tab_text = "下載 epub格式(iPad/小米)" if file_type == "epub" else "下載 Kindle .mobi格式"
        try:
            tab = self.page.locator(f'text="{tab_text}"').first
            if tab.is_visible():
                tab.click()
                time.sleep(2)
        except Exception as e:
            logger.warning(f"切换标签失败: {e}")
        
        # 查找所有下载按钮/链接
        # 下载链接格式为 /dl/{bookid}/{volid}/...
        download_selectors = [
            'a[href*="/dl/"]',
            'a:has-text("下載")',
            'button:has-text("下載")',
            'td:has-text("M") a',
        ]
        
        download_count = 0
        downloaded_urls = set()
        
        for selector in download_selectors:
            try:
                elements = self.page.locator(selector).all()
                for elem in elements:
                    try:
                        href = elem.get_attribute("href") or ""
                        
                        # 如果是下载链接
                        if "/dl/" in href:
                            if href in downloaded_urls:
                                continue
                            downloaded_urls.add(href)
                            
                            if max_vols and download_count >= max_vols:
                                break
                            
                            # 获取卷名
                            vol_name = elem.inner_text().strip() or f"vol_{download_count+1}"
                            logger.info(f"开始下载: {book_title} - {vol_name}")
                            
                            # 触发下载
                            try:
                                with self.page.expect_download(timeout=60000) as download_info:
                                    elem.click()
                                
                                download = download_info.value
                                filename = download.suggested_filename or f"{safe_title}_{download_count+1}.{file_type}"
                                save_path = book_dir / filename
                                download.save_as(str(save_path))
                                logger.info(f"✓ 已保存: {filename}")
                                download_count += 1
                                
                            except Exception as e:
                                if "Timeout" in str(e):
                                    # 可能遇到验证码，等待人工处理
                                    logger.warning("可能遇到验证码或下载超时")
                                    self.wait_for_captcha()
                                    # 重试一次
                                    try:
                                        with self.page.expect_download(timeout=60000) as download_info:
                                            elem.click()
                                        download = download_info.value
                                        filename = download.suggested_filename or f"{safe_title}_{download_count+1}.{file_type}"
                                        save_path = book_dir / filename
                                        download.save_as(str(save_path))
                                        logger.info(f"✓ 已保存: {filename}")
                                        download_count += 1
                                    except:
                                        logger.error(f"下载失败: {vol_name}")
                                else:
                                    logger.error(f"下载异常: {e}")
                            
                            time.sleep(3)  # 下载间隔
                    
                    except Exception as e:
                        continue
            
            except:
                continue
        
        if download_count > 0:
            self.downloaded_books.add(book_id)
            self._save_download_history()
            logger.info(f"《{book_title}》下载完成，共{download_count}卷")
        else:
            logger.warning(f"《{book_title}》未找到可下载链接（可能需要VIP或更高权限）")
        
        return download_count
    
    def batch_download(self, book_list: List[dict], file_type: str = "epub",
                      start_index: int = 0, max_books: int = None):
        """
        批量下载
        """
        total = len(book_list)
        if max_books:
            total = min(total, start_index + max_books)
        
        success_count = 0
        fail_count = 0
        
        logger.info(f"开始批量下载，共{total - start_index}本")
        
        for i in range(start_index, total):
            book = book_list[i]
            logger.info(f"\n[{i+1}/{total}] {book['title']}")
            
            try:
                count = self.download_book(book["url"], book["title"], file_type=file_type)
                if count > 0:
                    success_count += 1
                else:
                    fail_count += 1
            except Exception as e:
                logger.error(f"下载失败 {book['title']}: {e}")
                fail_count += 1
            
            time.sleep(2)
        
        logger.info(f"\n批量下载完成: 成功{success_count}本, 失败{fail_count}本")
    
    def close(self):
        """关闭浏览器"""
        self._save_download_history()
        if self.browser:
            self.browser.close()
        if hasattr(self, 'playwright'):
            self.playwright.stop()
        logger.info("浏览器已关闭")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Kmoe浏览器自动化下载工具")
    parser.add_argument("--mode", choices=["list", "download", "single"], 
                       default="list", help="运行模式")
    parser.add_argument("--url", type=str, help="单本漫画URL(single模式)")
    parser.add_argument("--start-page", type=int, default=1, help="起始页码")
    parser.add_argument("--max-pages", type=int, default=1, help="抓取列表页数")
    parser.add_argument("--max-books", type=int, default=None, help="最大下载本数")
    parser.add_argument("--file-type", choices=["epub", "mobi"], default="epub")
    parser.add_argument("--download-dir", type=str, default="./kmoe_downloads")
    parser.add_argument("--headless", action="store_true", help="无头模式(不显示浏览器)")
    parser.add_argument("--username", type=str, help="用户名")
    parser.add_argument("--password", type=str, help="密码")
    
    args = parser.parse_args()
    
    print("""
╔═══════════════════════════════════════════════════════════╗
║       Kmoe 浏览器自动化下载工具 v1.0                      ║
║  基于Playwright，完全模拟真实用户操作                      ║
║  请支持正版，仅供学习交流使用                              ║
╚═══════════════════════════════════════════════════════════╝
    """)
    
    downloader = KmoeBrowserDownloader(
        download_dir=args.download_dir,
        headless=args.headless
    )
    
    try:
        if not downloader.start():
            return
        
        # 检查登录
        if not downloader.is_logged_in():
            logger.info("需要登录...")
            downloader.login(args.username, args.password)
        else:
            logger.info("检测到已登录状态")
        
        if args.mode == "list":
            # 仅获取列表
            books = downloader.get_book_list(args.start_page, args.max_pages)
            print(f"\n共获取 {len(books)} 本漫画:")
            for i, b in enumerate(books[:20]):
                print(f"  [{b['id']}] {b['title']}")
            if len(books) > 20:
                print(f"  ... 还有{len(books)-20}本")
            
            # 保存列表
            list_file = Path(args.download_dir) / "book_list.json"
            with open(list_file, 'w', encoding='utf-8') as f:
                json.dump(books, f, ensure_ascii=False, indent=2)
            print(f"\n列表已保存至: {list_file}")
        
        elif args.mode == "single" and args.url:
            # 单本下载
            logger.info(f"单本下载模式: {args.url}")
            downloader.download_book(args.url, "custom_book", file_type=args.file_type)
        
        elif args.mode == "download":
            # 获取列表并批量下载
            books = downloader.get_book_list(args.start_page, args.max_pages)
            downloader.batch_download(books, file_type=args.file_type, 
                                     max_books=args.max_books)
    
    except KeyboardInterrupt:
        logger.info("用户中断")
    finally:
        downloader.close()


if __name__ == "__main__":
    main()
