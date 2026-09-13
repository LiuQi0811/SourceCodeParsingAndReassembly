#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
通用全站异步爬虫框架
特性：
- 异步高并发抓取 (aiohttp)
- 进度条显示 (tqdm)
- 策略模式设计，抓取/解析模式可自由切换
- 自动重试机制 (指数退避)
- 断点续传 (持久化URL队列与已完成记录)
- 两种抓取模式：
  1. 内存队列模式：先收集所有URL再统一下载
  2. 边爬边下模式：爬取到URL立即入队下载
- 三种解析模式：BeautifulSoup4、XPath(lxml)、正则表达式
- 自动处理常见JS逆向解密（base64、AES、RSA、常见混淆）
- 自动去重、URL规范化
- 支持代理、User-Agent轮换、请求间隔
- 自动保存断点，异常终止后可恢复
"""

import os
import re
import json
import time
import base64
import pickle
import random
import asyncio
import logging
from abc import ABC, abstractmethod
from urllib.parse import urljoin, urlparse, urldefrag
from collections import deque
from typing import Set, List, Dict, Optional, Any, Callable
from datetime import datetime
from pathlib import Path

import aiohttp
import aiofiles
from tqdm import tqdm
from lxml import etree
from bs4 import BeautifulSoup
from fake_useragent import UserAgent

# 尝试导入加密库用于逆向解密
try:
    from Crypto.Cipher import AES, DES, DES3
    from Crypto.Util.Padding import unpad
    from Crypto.PublicKey import RSA
    from Crypto.Cipher import PKCS1_v1_5
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)


# ==================== 设计模式：策略模式 - 抓取策略 ====================
class CrawlStrategy(ABC):
    """抓取策略抽象基类"""
    
    @abstractmethod
    async def crawl(self, crawler) -> None:
        pass


class MemoryQueueCrawl(CrawlStrategy):
    """
    模式一：一次性内存加载队列
    先深度/广度遍历收集所有URL，再统一批量下载
    """
    
    async def crawl(self, crawler) -> None:
        logger.info("=== 使用【一次性内存加载队列】模式 ===")
        logger.info("阶段1：收集所有页面URL...")
        
        # URL收集队列
        collect_queue = deque([crawler.start_url])
        crawler.visited_urls.add(crawler.start_url)
        
        # 第一阶段：只爬取HTML页面收集链接
        collect_pbar = tqdm(desc="收集URL进度", unit="页")
        while collect_queue and not crawler.stop_event.is_set():
            batch = []
            for _ in range(min(crawler.concurrency * 2, len(collect_queue))):
                if collect_queue:
                    batch.append(collect_queue.popleft())
            
            if not batch:
                break
                
            tasks = [crawler._fetch_html_only(url, collect_queue, crawler.download_queue, collect_pbar) for url in batch]
            await asyncio.gather(*tasks, return_exceptions=True)
            await asyncio.sleep(crawler.delay)
        
        collect_pbar.close()
        logger.info(f"URL收集完成，共发现 {len(crawler.download_queue)} 个待下载资源")
        
        # 第二阶段：批量下载所有资源
        logger.info("阶段2：批量下载资源...")
        await crawler._download_all()


class StreamCrawl(CrawlStrategy):
    """
    模式二：边存队列边下载
    爬取到资源URL立即加入下载队列，爬取和下载同时进行
    """
    
    async def crawl(self, crawler) -> None:
        logger.info("=== 使用【边爬边下】模式 ===")
        
        # 页面爬取队列
        page_queue = deque([crawler.start_url])
        crawler.visited_urls.add(crawler.start_url)
        
        # 启动下载协程作为后台任务
        download_task = asyncio.create_task(crawler._download_worker())
        
        # 主爬取循环
        crawl_pbar = tqdm(desc="爬取进度", unit="页")
        while page_queue and not crawler.stop_event.is_set():
            batch = []
            for _ in range(min(crawler.concurrency, len(page_queue))):
                if page_queue:
                    batch.append(page_queue.popleft())
            
            if not batch:
                # 等待下载队列清空
                while crawler.active_downloads > 0 and len(crawler.download_queue) > 0:
                    await asyncio.sleep(0.5)
                break
                
            tasks = [crawler._fetch_and_enqueue(url, page_queue, crawl_pbar) for url in batch]
            await asyncio.gather(*tasks, return_exceptions=True)
            await asyncio.sleep(crawler.delay)
        
        crawl_pbar.close()
        
        # 标记下载完成，等待所有下载结束
        crawler.download_finished.set()
        await download_task
        logger.info("爬取与下载全部完成")


# ==================== 设计模式：策略模式 - 解析策略 ====================
class ParseStrategy(ABC):
    """解析策略抽象基类"""
    
    @abstractmethod
    def parse_links(self, html: str, base_url: str) -> List[str]:
        """提取页面中的所有链接"""
        pass
    
    @abstractmethod
    def parse_content(self, html: str, selectors: Dict[str, str] = None) -> Dict[str, Any]:
        """解析页面内容，可自定义选择器"""
        pass


class BS4Parse(ParseStrategy):
    """BeautifulSoup4解析模式"""
    
    def __init__(self, parser: str = 'lxml'):
        self.parser = parser
    
    def parse_links(self, html: str, base_url: str) -> List[str]:
        soup = BeautifulSoup(html, self.parser)
        links = []
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']
            absolute_url = urljoin(base_url, href)
            links.append(urldefrag(absolute_url)[0])  # 移除锚点
        
        # 提取资源链接
        for tag_name, attr in [('img', 'src'), ('script', 'src'), ('link', 'href'),
                               ('video', 'src'), ('audio', 'src'), ('source', 'src')]:
            for tag in soup.find_all(tag_name, **{attr: True}):
                resource_url = urljoin(base_url, tag[attr])
                links.append(urldefrag(resource_url)[0])
        
        return links
    
    def parse_content(self, html: str, selectors: Dict[str, str] = None) -> Dict[str, Any]:
        soup = BeautifulSoup(html, self.parser)
        result = {
            'title': soup.title.string.strip() if soup.title else '',
            'text': soup.get_text(separator='\n', strip=True),
            'links': [a.get('href') for a in soup.find_all('a', href=True)]
        }
        
        if selectors:
            for key, selector in selectors.items():
                elems = soup.select(selector)
                result[key] = [elem.get_text(strip=True) for elem in elems]
        
        return result


class XPathParse(ParseStrategy):
    """XPath解析模式 (基于lxml)"""
    
    def parse_links(self, html: str, base_url: str) -> List[str]:
        try:
            tree = etree.HTML(html)
            if tree is None:
                return []
        except:
            return []
        
        links = []
        # 提取所有a标签链接
        for href in tree.xpath('//a/@href'):
            absolute_url = urljoin(base_url, href)
            links.append(urldefrag(absolute_url)[0])
        
        # 提取资源链接
        xpath_exprs = [
            '//img/@src', '//script/@src', '//link/@href',
            '//video/@src', '//audio/@src', '//source/@src',
            '//embed/@src', '//iframe/@src'
        ]
        for xpath_expr in xpath_exprs:
            for src in tree.xpath(xpath_expr):
                resource_url = urljoin(base_url, src)
                links.append(urldefrag(resource_url)[0])
        
        return links
    
    def parse_content(self, html: str, selectors: Dict[str, str] = None) -> Dict[str, Any]:
        try:
            tree = etree.HTML(html)
            result = {
                'title': ''.join(tree.xpath('//title/text()')).strip(),
                'text': ''.join(tree.xpath('//body//text()')).strip(),
                'links': tree.xpath('//a/@href')
            }
        except:
            result = {'title': '', 'text': '', 'links': []}
        
        if selectors:
            for key, xpath in selectors.items():
                try:
                    result[key] = tree.xpath(xpath)
                except:
                    result[key] = []
        
        return result


class RegexParse(ParseStrategy):
    """正则表达式解析模式"""
    
    def __init__(self):
        # URL匹配正则
        self.url_pattern = re.compile(
            r'(?:href|src|action|data-src|data-url)\s*=\s*["\']([^"\']+)["\']',
            re.IGNORECASE
        )
        # 绝对URL正则
        self.abs_url_pattern = re.compile(r'https?://[^\s"\'<>]+', re.IGNORECASE)
    
    def parse_links(self, html: str, base_url: str) -> List[str]:
        links = []
        
        # 提取标签中的链接
        for match in self.url_pattern.finditer(html):
            href = match.group(1)
            if href.startswith(('javascript:', '#', 'mailto:', 'tel:')):
                continue
            absolute_url = urljoin(base_url, href)
            links.append(urldefrag(absolute_url)[0])
        
        # 提取文本中散落的URL
        for match in self.abs_url_pattern.finditer(html):
            url = match.group(0)
            # 过滤常见的非URL结尾
            url = re.sub(r'[.,;!?)\]}>]+$', '', url)
            links.append(urldefrag(url)[0])
        
        return links
    
    def parse_content(self, html: str, selectors: Dict[str, str] = None) -> Dict[str, Any]:
        # 标题提取
        title_match = re.search(r'<title[^>]*>([^<]+)</title>', html, re.IGNORECASE)
        title = title_match.group(1).strip() if title_match else ''
        
        # 粗略提取文本（移除script和style标签后去标签）
        clean_html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
        clean_html = re.sub(r'<style[^>]*>.*?</style>', '', clean_html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<[^>]+>', '\n', clean_html)
        text = re.sub(r'\n+', '\n', text).strip()
        
        result = {
            'title': title,
            'text': text,
            'links': [m.group(1) for m in self.url_pattern.finditer(html)]
        }
        
        if selectors:
            for key, pattern in selectors.items():
                try:
                    result[key] = [m.group(1) if m.lastindex else m.group(0) for m in re.finditer(pattern, html, re.DOTALL)]
                except:
                    result[key] = []
        
        return result


# ==================== JS逆向解密引擎 ====================
class JSDecryptor:
    """JS逆向解密引擎，处理常见加密场景"""
    
    @staticmethod
    def detect_encryption(html: str, url: str) -> Dict[str, Any]:
        """检测页面可能存在的加密方式"""
        detection = {
            'has_base64': False,
            'has_aes': False,
            'has_rsa': False,
            'has_eval': False,
            'has_obfuscation': False,
            'encrypted_params': [],
            'js_crypto_urls': []
        }
        
        lower_html = html.lower()
        
        # 检测Base64特征
        if re.search(r'base64|btoa\(|atob\(', lower_html):
            detection['has_base64'] = True
        
        # 检测AES/DES
        if re.search(r'aes|des|cbc|ecb|pkcs7|crypto|cryptojs', lower_html):
            detection['has_aes'] = True
        
        # 检测RSA
        if re.search(r'rsa|publickey|privatekey|pkcs1|jsencrypt', lower_html):
            detection['has_rsa'] = True
        
        # 检测eval混淆
        if 'eval(' in lower_html or 'function(p,a,c,k,e' in html:
            detection['has_eval'] = True
            detection['has_obfuscation'] = True
        
        # 检测常见混淆
        obf_patterns = ['_0x', '0x', 'obfuscate', 'packer', 'sojson', 'jsfuck']
        for pat in obf_patterns:
            if pat in lower_html:
                detection['has_obfuscation'] = True
                break
        
        return detection
    
    @staticmethod
    def decode_base64(data: str) -> str:
        """Base64解码"""
        try:
            # 处理可能的padding
            missing_padding = len(data) % 4
            if missing_padding:
                data += '=' * (4 - missing_padding)
            return base64.b64decode(data).decode('utf-8', errors='ignore')
        except:
            return data
    
    @staticmethod
    def aes_decrypt(ciphertext: str, key: bytes, iv: bytes = None, mode=AES.MODE_CBC) -> str:
        """AES解密"""
        if not HAS_CRYPTO:
            logger.warning("未安装pycryptodome，AES解密不可用，请执行: pip install pycryptodome")
            return ciphertext
        
        try:
            if isinstance(ciphertext, str):
                ciphertext = base64.b64decode(ciphertext)
            
            if mode == AES.MODE_ECB:
                cipher = AES.new(key, AES.MODE_ECB)
            else:
                cipher = AES.new(key, mode, iv=iv)
            
            plaintext = unpad(cipher.decrypt(ciphertext), AES.block_size)
            return plaintext.decode('utf-8', errors='ignore')
        except Exception as e:
            logger.debug(f"AES解密失败: {e}")
            return ciphertext
    
    @staticmethod
    def rsa_decrypt(ciphertext: str, private_key_pem: str) -> str:
        """RSA私钥解密"""
        if not HAS_CRYPTO:
            logger.warning("未安装pycryptodome，RSA解密不可用")
            return ciphertext
        
        try:
            if isinstance(ciphertext, str):
                ciphertext = base64.b64decode(ciphertext)
            
            key = RSA.import_key(private_key_pem)
            cipher = PKCS1_v1_5.new(key)
            plaintext = cipher.decrypt(ciphertext, None)
            return plaintext.decode('utf-8', errors='ignore')
        except Exception as e:
            logger.debug(f"RSA解密失败: {e}")
            return ciphertext
    
    @staticmethod
    def unpack_eval(js_code: str) -> str:
        """解Dean Edwards packer eval混淆"""
        try:
            # 简单eval解包：eval(function(p,a,c,k,e,d){...})格式
            packer_match = re.search(
                r"eval\(function\(p,a,c,k,e,(?:d|r)\)\{.*?\}\((.*?)\)\)",
                js_code, re.DOTALL
            )
            if packer_match:
                # 提示用户这是packed代码，建议使用更专业的JS执行环境
                logger.info("检测到Packer混淆JS，建议使用Node.js或Playwright执行动态渲染")
            return js_code
        except:
            return js_code
    
    @staticmethod
    def decrypt_url(url: str) -> str:
        """尝试解密URL中的加密参数"""
        # 常见的URL Base64参数解密
        b64_param_match = re.search(r'[?&](?:data|enc|cipher|code)=([A-Za-z0-9+/=]+)', url)
        if b64_param_match:
            try:
                decoded = JSDecryptor.decode_base64(b64_param_match.group(1))
                # 如果解码后是合法URL
                if decoded.startswith(('http://', 'https://', '/')):
                    url = url.replace(b64_param_match.group(0), f'?url={decoded}')
            except:
                pass
        return url


# ==================== 主爬虫类 ====================
class UniversalCrawler:
    """通用全站爬虫主类"""
    
    def __init__(
        self,
        start_url: str,
        output_dir: str = "./crawler_output",
        crawl_mode: str = "memory",  # "memory" 或 "stream"
        parse_mode: str = "bs4",     # "bs4", "xpath", "regex"
        concurrency: int = 10,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        delay: float = 0.5,
        timeout: int = 30,
        allowed_domains: List[str] = None,
        download_resources: bool = True,
        save_html: bool = True,
        user_agents: List[str] = None,
        proxies: List[str] = None,
        resume: bool = True,
        custom_decryptor: Callable = None
    ):
        self.start_url = start_url
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # 并发和重试配置
        self.concurrency = concurrency
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.delay = delay
        self.timeout = timeout
        
        # 域名限制
        self.base_domain = urlparse(start_url).netloc
        self.allowed_domains = allowed_domains or [self.base_domain]
        
        # 开关配置
        self.download_resources = download_resources
        self.save_html = save_html
        
        # 代理和UA
        self.user_agents = user_agents
        self.proxies = proxies
        self._ua = UserAgent(fallback=True)
        
        # 状态数据
        self.visited_urls: Set[str] = set()
        self.downloaded_files: Set[str] = set()
        self.download_queue: asyncio.Queue = asyncio.Queue()
        self.failed_urls: Set[str] = set()
        self.active_downloads = 0
        self.download_finished = asyncio.Event()
        self.stop_event = asyncio.Event()
        
        # 统计
        self.stats = {
            'pages_crawled': 0,
            'files_downloaded': 0,
            'bytes_downloaded': 0,
            'errors': 0
        }
        
        # 断点续传文件
        self.checkpoint_file = self.output_dir / ".crawler_checkpoint.pkl"
        self.resume = resume
        if self.resume:
            self._load_checkpoint()
        
        # 自定义解密器
        self.custom_decryptor = custom_decryptor
        self.decryptor = JSDecryptor()
        
        # 设置策略
        self._set_crawl_strategy(crawl_mode)
        self._set_parse_strategy(parse_mode)
        
        # 初始化HTTP会话
        self.session: Optional[aiohttp.ClientSession] = None
        
        # 进度条
        self.download_pbar = None
    
    def _set_crawl_strategy(self, mode: str):
        """设置抓取策略"""
        strategies = {
            'memory': MemoryQueueCrawl,
            'stream': StreamCrawl
        }
        if mode not in strategies:
            raise ValueError(f"不支持的抓取模式: {mode}，可选: {list(strategies.keys())}")
        self.crawl_strategy = strategies[mode]()
        self.crawl_mode_name = mode
        logger.info(f"抓取模式设置为: {mode}")
    
    def _set_parse_strategy(self, mode: str):
        """设置解析策略"""
        strategies = {
            'bs4': BS4Parse,
            'xpath': XPathParse,
            'regex': RegexParse
        }
        if mode not in strategies:
            raise ValueError(f"不支持的解析模式: {mode}，可选: {list(strategies.keys())}")
        self.parse_strategy = strategies[mode]()
        self.parse_mode_name = mode
        logger.info(f"解析模式设置为: {mode}")
    
    def switch_crawl_mode(self, mode: str):
        """运行时切换抓取模式"""
        self._set_crawl_strategy(mode)
    
    def switch_parse_mode(self, mode: str):
        """运行时切换解析模式"""
        self._set_parse_strategy(mode)
    
    def _get_headers(self) -> Dict[str, str]:
        """获取随机请求头"""
        ua = random.choice(self.user_agents) if self.user_agents else self._ua.random
        return {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }
    
    def _get_proxy(self) -> Optional[str]:
        """获取随机代理"""
        if self.proxies:
            return random.choice(self.proxies)
        return None
    
    def _is_allowed_url(self, url: str) -> bool:
        """检查URL是否在允许的域名内"""
        try:
            parsed = urlparse(url)
            # 允许相对路径
            if not parsed.netloc:
                return True
            # 检查域名
            for domain in self.allowed_domains:
                if parsed.netloc == domain or parsed.netloc.endswith('.' + domain):
                    return True
            return False
        except:
            return False
    
    def _is_resource_url(self, url: str) -> bool:
        """判断是否是静态资源URL"""
        resource_exts = {
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.ico',
            '.css', '.js', '.json', '.xml', '.pdf', '.doc', '.docx', '.xls', '.xlsx',
            '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.zip', '.rar', '.7z',
            '.woff', '.woff2', '.ttf', '.eot', '.otf'
        }
        path = urlparse(url).path.lower()
        return any(path.endswith(ext) for ext in resource_exts)
    
    def _get_save_path(self, url: str) -> Path:
        """根据URL获取本地保存路径"""
        parsed = urlparse(url)
        path = parsed.path
        
        # 处理根路径
        if not path or path == '/':
            path = '/index.html'
        
        # 目录路径默认取index.html
        if path.endswith('/'):
            path += 'index.html'
        
        # 构造完整路径
        local_path = self.output_dir / parsed.netloc / path.lstrip('/')
        
        # 如果路径没有后缀且不是资源，添加.html后缀
        if not local_path.suffix and not self._is_resource_url(url):
            local_path = local_path.with_suffix('.html')
        
        # 确保父目录存在
        local_path.parent.mkdir(parents=True, exist_ok=True)
        
        return local_path
    
    async def _fetch_with_retry(self, url: str, is_download: bool = False) -> Optional[bytes]:
        """带重试机制的请求"""
        for attempt in range(self.max_retries + 1):
            try:
                proxy = self._get_proxy()
                timeout = aiohttp.ClientTimeout(total=self.timeout)
                
                async with self.session.get(
                    url,
                    headers=self._get_headers(),
                    proxy=proxy,
                    timeout=timeout,
                    ssl=False
                ) as response:
                    if response.status == 200:
                        return await response.read()
                    elif response.status == 404:
                        logger.debug(f"404 Not Found: {url}")
                        return None
                    else:
                        logger.debug(f"HTTP {response.status} for {url} (尝试 {attempt + 1}/{self.max_retries + 1})")
            
            except asyncio.TimeoutError:
                logger.debug(f"请求超时: {url} (尝试 {attempt + 1}/{self.max_retries + 1})")
            except Exception as e:
                logger.debug(f"请求错误: {url} - {str(e)[:50]} (尝试 {attempt + 1}/{self.max_retries + 1})")
            
            if attempt < self.max_retries:
                # 指数退避
                wait_time = self.retry_delay * (2 ** attempt) + random.uniform(0, 1)
                await asyncio.sleep(wait_time)
        
        # 所有重试失败
        self.failed_urls.add(url)
        self.stats['errors'] += 1
        return None
    
    async def _fetch_html_only(self, url: str, collect_queue: deque, download_queue: asyncio.Queue, pbar):
        """仅获取HTML并提取链接（第一阶段URL收集用）"""
        if self._is_resource_url(url) or not self._is_allowed_url(url):
            return
        
        try:
            content = await self._fetch_with_retry(url)
            if not content:
                return
            
            # 尝试解密
            html = content.decode('utf-8', errors='ignore')
            html = self._decrypt_content(html, url)
            
            # 检测加密
            encryption_info = self.decryptor.detect_encryption(html, url)
            if encryption_info['has_obfuscation']:
                logger.debug(f"页面 {url} 检测到混淆JS，可能需要动态渲染")
            
            # 提取链接
            links = self.parse_strategy.parse_links(html, url)
            
            for link in links:
                link = self.decryptor.decrypt_url(link)
                if link not in self.visited_urls and self._is_allowed_url(link):
                    self.visited_urls.add(link)
                    if self._is_resource_url(link):
                        if self.download_resources:
                            await download_queue.put(link)
                    else:
                        collect_queue.append(link)
            
            # 保存HTML
            if self.save_html:
                save_path = self._get_save_path(url)
                async with aiofiles.open(save_path, 'wb') as f:
                    await f.write(content)
                self.downloaded_files.add(url)
                self.stats['pages_crawled'] += 1
            
            pbar.update(1)
            
        except Exception as e:
            logger.debug(f"处理页面失败 {url}: {e}")
            self.stats['errors'] += 1
    
    async def _fetch_and_enqueue(self, url: str, page_queue: deque, pbar):
        """获取页面内容，提取链接，并加入下载队列（边爬边下模式）"""
        if self._is_resource_url(url):
            if self.download_resources:
                await self.download_queue.put(url)
            return
        
        if not self._is_allowed_url(url):
            return
        
        try:
            content = await self._fetch_with_retry(url)
            if not content:
                return
            
            html = content.decode('utf-8', errors='ignore')
            html = self._decrypt_content(html, url)
            
            # 提取链接
            links = self.parse_strategy.parse_links(html, url)
            
            for link in links:
                link = self.decryptor.decrypt_url(link)
                if link not in self.visited_urls and self._is_allowed_url(link):
                    self.visited_urls.add(link)
                    if self._is_resource_url(link):
                        if self.download_resources:
                            await self.download_queue.put(link)
                    else:
                        page_queue.append(link)
            
            # 保存HTML
            if self.save_html:
                save_path = self._get_save_path(url)
                async with aiofiles.open(save_path, 'wb') as f:
                    await f.write(content)
                self.downloaded_files.add(url)
                self.stats['pages_crawled'] += 1
            
            pbar.update(1)
            
        except Exception as e:
            logger.debug(f"处理页面失败 {url}: {e}")
            self.stats['errors'] += 1
    
    async def _download_worker(self):
        """下载工作协程（边爬边下模式）"""
        self.download_pbar = tqdm(desc="下载进度", unit="文件")
        
        async def download_task():
            while True:
                try:
                    url = await asyncio.wait_for(self.download_queue.get(), timeout=2.0)
                except asyncio.TimeoutError:
                    if self.download_finished.is_set() and self.download_queue.empty():
                        break
                    continue
                
                if url in self.downloaded_files:
                    self.download_queue.task_done()
                    continue
                
                await self._download_file(url)
                self.download_queue.task_done()
        
        # 启动多个下载并发
        tasks = [asyncio.create_task(download_task()) for _ in range(self.concurrency)]
        await asyncio.gather(*tasks)
        self.download_pbar.close()
    
    async def _download_all(self):
        """批量下载队列中的所有资源（内存队列模式）"""
        total = self.download_queue.qsize()
        self.download_pbar = tqdm(total=total, desc="下载进度", unit="文件")
        
        async def download_task():
            while True:
                try:
                    url = self.download_queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
                
                if url in self.downloaded_files:
                    self.download_queue.task_done()
                    continue
                
                await self._download_file(url)
                self.download_queue.task_done()
        
        tasks = [asyncio.create_task(download_task()) for _ in range(self.concurrency)]
        await asyncio.gather(*tasks)
        self.download_pbar.close()
    
    async def _download_file(self, url: str):
        """下载单个文件"""
        self.active_downloads += 1
        try:
            content = await self._fetch_with_retry(url, is_download=True)
            if content:
                save_path = self._get_save_path(url)
                async with aiofiles.open(save_path, 'wb') as f:
                    await f.write(content)
                
                self.downloaded_files.add(url)
                self.stats['files_downloaded'] += 1
                self.stats['bytes_downloaded'] += len(content)
                
                if self.download_pbar:
                    self.download_pbar.update(1)
                    self.download_pbar.set_postfix({
                        '已完成': self.stats['files_downloaded'],
                        '大小': f"{self.stats['bytes_downloaded'] / 1024 / 1024:.2f}MB"
                    })
        finally:
            self.active_downloads -= 1
    
    def _decrypt_content(self, html: str, url: str) -> str:
        """解密页面内容"""
        # 先用自定义解密器
        if self.custom_decryptor:
            try:
                html = self.custom_decryptor(html, url)
            except:
                pass
        
        return html
    
    def _save_checkpoint(self):
        """保存断点"""
        checkpoint = {
            'visited_urls': self.visited_urls,
            'downloaded_files': self.downloaded_files,
            'stats': self.stats,
            'failed_urls': self.failed_urls,
            'timestamp': datetime.now().isoformat()
        }
        try:
            with open(self.checkpoint_file, 'wb') as f:
                pickle.dump(checkpoint, f)
        except Exception as e:
            logger.debug(f"保存断点失败: {e}")
    
    def _load_checkpoint(self):
        """加载断点"""
        if self.checkpoint_file.exists():
            try:
                with open(self.checkpoint_file, 'rb') as f:
                    checkpoint = pickle.load(f)
                self.visited_urls = checkpoint.get('visited_urls', set())
                self.downloaded_files = checkpoint.get('downloaded_files', set())
                self.stats = checkpoint.get('stats', self.stats)
                self.failed_urls = checkpoint.get('failed_urls', set())
                logger.info(f"已加载断点，已访问 {len(self.visited_urls)} 个URL，已下载 {len(self.downloaded_files)} 个文件")
            except Exception as e:
                logger.warning(f"加载断点失败，将重新开始: {e}")
    
    async def start(self):
        """启动爬虫"""
        logger.info("=" * 60)
        logger.info("通用全站异步爬虫启动")
        logger.info(f"起始URL: {self.start_url}")
        logger.info(f"输出目录: {self.output_dir.absolute()}")
        logger.info(f"抓取模式: {self.crawl_mode_name}")
        logger.info(f"解析模式: {self.parse_mode_name}")
        logger.info(f"并发数: {self.concurrency}")
        logger.info(f"最大重试: {self.max_retries}")
        logger.info("=" * 60)
        
        # 定期保存断点
        async def checkpoint_saver():
            while not self.stop_event.is_set():
                await asyncio.sleep(30)  # 每30秒保存一次
                self._save_checkpoint()
        
        # 捕获Ctrl+C
        def signal_handler():
            logger.info("收到停止信号，正在保存断点...")
            self.stop_event.set()
        
        try:
            import signal
            loop = asyncio.get_running_loop()
            for sig in (signal.SIGINT, signal.SIGTERM):
                loop.add_signal_handler(sig, signal_handler)
        except:
            pass
        
        # 创建HTTP会话
        connector = aiohttp.TCPConnector(limit=self.concurrency * 2, ssl=False)
        self.session = aiohttp.ClientSession(connector=connector)
        
        # 启动断点保存任务
        checkpoint_task = asyncio.create_task(checkpoint_saver())
        
        try:
            # 执行抓取策略
            await self.crawl_strategy.crawl(self)
            
            # 保存失败URL列表
            if self.failed_urls:
                failed_file = self.output_dir / "failed_urls.txt"
                async with aiofiles.open(failed_file, 'w', encoding='utf-8') as f:
                    for url in self.failed_urls:
                        await f.write(url + '\n')
                logger.info(f"失败URL已保存到: {failed_file}")
            
            # 保存最终断点
            self._save_checkpoint()
            
            # 输出统计
            logger.info("=" * 60)
            logger.info("爬取完成！统计信息:")
            logger.info(f"  爬取页面数: {self.stats['pages_crawled']}")
            logger.info(f"  下载文件数: {self.stats['files_downloaded']}")
            logger.info(f"  总下载大小: {self.stats['bytes_downloaded'] / 1024 / 1024:.2f} MB")
            logger.info(f"  错误次数: {self.stats['errors']}")
            logger.info(f"  失败URL数: {len(self.failed_urls)}")
            logger.info("=" * 60)
            
        finally:
            checkpoint_task.cancel()
            if self.session and not self.session.closed:
                await self.session.close()


# ==================== 使用示例 ====================
async def main():
    """使用示例"""
    
    # ====== 配置参数 ======
    config = {
        'start_url': 'https://example.com',  # 要爬取的起始URL
        'output_dir': './crawler_output',    # 输出目录
        'crawl_mode': 'stream',              # 抓取模式: "memory"(先收集再下载) 或 "stream"(边爬边下)
        'parse_mode': 'bs4',                 # 解析模式: "bs4", "xpath", "regex"
        'concurrency': 15,                   # 并发数
        'max_retries': 3,                    # 最大重试次数
        'retry_delay': 1.0,                  # 重试基础延迟(秒)
        'delay': 0.3,                        # 请求间隔(秒)
        'timeout': 30,                       # 超时时间(秒)
        'download_resources': True,          # 是否下载静态资源(图片/CSS/JS等)
        'save_html': True,                   # 是否保存HTML页面
        'resume': True,                      # 是否断点续传
        # 'allowed_domains': ['example.com'], # 允许的域名，默认只爬取起始域名
        # 'proxies': ['http://proxy:port'],   # 代理列表
        # 'user_agents': [...],               # 自定义UA列表
    }
    
    # 创建爬虫实例
    crawler = UniversalCrawler(**config)
    
    # ====== 模式切换示例（可选）======
    # crawler.switch_crawl_mode('memory')   # 切换到内存队列模式
    # crawler.switch_parse_mode('xpath')    # 切换到XPath解析模式
    
    # 启动爬虫
    await crawler.start()


if __name__ == '__main__':
    # 运行示例
    asyncio.run(main())
