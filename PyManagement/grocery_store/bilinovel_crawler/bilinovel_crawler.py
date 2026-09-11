#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
哔哩轻小说(bilinovel.com / linovelib.com)全站爬虫
包含完美逆向解密：章节段落乱序还原算法实现
支持：单本小说下载、批量下载、图片下载、TXT/EPUB导出
"""

import os
import re
import sys
import json
import time
import math
import random
import base64
import hashlib
import zipfile
import shutil
from urllib.parse import urljoin, urlparse
from collections import OrderedDict
from datetime import datetime

import requests
from bs4 import BeautifulSoup
from fake_useragent import UserAgent
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ==================== 配置区域 ====================
CONFIG = {
    # 请求配置
    'domain': 'https://www.bilinovel.com',
    'request_timeout': 30,
    'request_delay_min': 1.0,      # 最小请求间隔(秒)
    'request_delay_max': 3.0,      # 最大请求间隔(秒)
    'max_retries': 3,              # 最大重试次数
    'use_mobile_ua': True,         # 使用移动端UA(推荐)
    
    # 下载配置
    'download_images': True,       # 是否下载插图
    'image_quality': 'high',       # 图片质量: high/low
    'combine_volumes': False,      # 是否合并分卷(EPUB)
    'output_format': ['txt', 'epub'],  # 输出格式: txt, epub
    
    # 保存路径
    'save_dir': './bilinovel_downloads',
    'image_dir_name': 'images',
    
    # 全站爬取配置
    'crawl_all': False,            # 是否爬取全站所有小说
    'max_novels': 0,               # 最大爬取小说数(0=不限制)
    'start_page': 1,               # 从分类第几页开始
}

# ==================== 工具类 ====================
class RateLimiter:
    """请求限流器"""
    def __init__(self, min_delay=1.0, max_delay=3.0):
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.last_request_time = 0
        
    def wait(self):
        elapsed = time.time() - self.last_request_time
        delay = random.uniform(self.min_delay, self.max_delay)
        if elapsed < delay:
            time.sleep(delay - elapsed)
        self.last_request_time = time.time()

class ExpressionEvaluator:
    """JavaScript表达式求值器(用于解析混淆参数)"""
    def __init__(self, expr):
        self.expr = expr.strip()
        self.pos = 0
    
    def peek(self):
        if self.pos < len(self.expr):
            return self.expr[self.pos]
        return None
    
    def consume(self):
        if self.pos < len(self.expr):
            ch = self.expr[self.pos]
            self.pos += 1
            return ch
        return None
    
    def skip_whitespace(self):
        while self.pos < len(self.expr) and self.expr[self.pos].isspace():
            self.pos += 1
    
    def parse(self):
        result = self.parse_bitwise_xor()
        self.skip_whitespace()
        if self.pos != len(self.expr):
            raise ValueError(f"Unexpected character at position {self.pos}")
        return result
    
    def parse_bitwise_xor(self):
        value = self.parse_shift()
        while True:
            self.skip_whitespace()
            if self.peek() == '^':
                self.consume()
                value ^= self.parse_shift()
            else:
                return value
    
    def parse_shift(self):
        value = self.parse_add_sub()
        while True:
            self.skip_whitespace()
            if self.peek() is None:
                return value
            # 先检测3字符运算符 >>>
            if self.pos + 3 <= len(self.expr) and self.expr[self.pos:self.pos+3] == '>>>':
                self.pos += 3
                value = value >> self.parse_add_sub()
                continue
            # 再检测2字符运算符 >> <<
            if self.pos + 2 <= len(self.expr):
                two_char = self.expr[self.pos:self.pos+2]
                if two_char in ('>>', '<<'):
                    self.pos += 2
                    if two_char == '<<':
                        value <<= self.parse_add_sub()
                    else:
                        value >>= self.parse_add_sub()
                    continue
            return value
    
    def parse_add_sub(self):
        value = self.parse_mul_div_mod()
        while True:
            self.skip_whitespace()
            ch = self.peek()
            if ch == '+':
                self.consume()
                value += self.parse_mul_div_mod()
            elif ch == '-':
                self.consume()
                value -= self.parse_mul_div_mod()
            else:
                return value
    
    def parse_mul_div_mod(self):
        value = self.parse_unary()
        while True:
            self.skip_whitespace()
            ch = self.peek()
            if ch == '*':
                self.consume()
                value *= self.parse_unary()
            elif ch == '/':
                self.consume()
                value = int(value / self.parse_unary())
            elif ch == '%':
                self.consume()
                value %= self.parse_unary()
            else:
                return value
    
    def parse_unary(self):
        self.skip_whitespace()
        ch = self.peek()
        if ch == '+':
            self.consume()
            return self.parse_unary()
        elif ch == '-':
            self.consume()
            return -self.parse_unary()
        elif ch == '~':
            self.consume()
            return ~self.parse_unary()
        else:
            return self.parse_primary()
    
    def parse_primary(self):
        self.skip_whitespace()
        ch = self.peek()
        if ch == '(':
            self.consume()
            value = self.parse_bitwise_xor()
            self.skip_whitespace()
            if self.peek() == ')':
                self.consume()
            return value
        
        # 解析数字
        start = self.pos
        while self.pos < len(self.expr) and (self.expr[self.pos].isdigit() or self.expr[self.pos] in 'xabcdefABCDEF'):
            self.pos += 1
        num_str = self.expr[start:self.pos]
        if num_str.startswith('0x') or num_str.startswith('0X'):
            return int(num_str, 16)
        return int(num_str)

def eval_int_expression(expr):
    """对整数表达式求值"""
    if not expr:
        return None
    try:
        return ExpressionEvaluator(expr).parse()
    except:
        return None

def split_top_level(expr, operator):
    """在顶层括号级别分割表达式"""
    parts = []
    start = 0
    depth = 0
    i = 0
    op_len = len(operator)
    while i < len(expr):
        ch = expr[i]
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        elif depth == 0 and expr[i:i+op_len] == operator:
            parts.append(expr[start:i].strip())
            start = i + op_len
            i += op_len - 1
        i += 1
    parts.append(expr[start:].strip())
    return parts

def strip_outer_parentheses(expr):
    """去除外层括号"""
    value = expr.strip()
    while value.startswith('(') and value.endswith(')'):
        depth = 0
        wraps_all = True
        for i, ch in enumerate(value):
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0 and i != len(value) - 1:
                    wraps_all = False
                    break
        if not wraps_all:
            return value
        value = value[1:-1].strip()
    return value

def first_identifier(expr):
    """查找第一个标识符"""
    match = re.search(r'[_$a-zA-Z][_$a-zA-Z0-9]*', expr)
    return match.group(0) if match else None

def extract_trailing_expression(source, start_pattern, terminator):
    """提取终止符前的表达式"""
    match = start_pattern.search(source)
    if not match:
        return None
    start = match.end()
    depth = 0
    for i in range(start, len(source)):
        ch = source[i]
        if ch == '(':
            depth += 1
        elif ch == ')':
            if depth == 0 and terminator == ')':
                return source[start:i].strip()
            depth -= 1
        elif depth == 0 and ch == terminator:
            return source[start:i].strip()
    return None

# ==================== 核心解密类 ====================
class BiliNovelDecryptor:
    """哔哩轻小说段落乱序解密器 - 完美还原算法"""
    
    DEFAULT_FIXED_LENGTH = 20
    
    # 正则表达式模式
    FIXED_LENGTH_PATTERN = re.compile(r'if\s*\(\s*[_$a-zA-Z0-9]+\s*>\s*')
    SEED_EXPR_PATTERN = re.compile(r'=\s*(.+?Number\s*\(\s*chapterId\s*\).+?)\s*;')
    LCG_EXPR_PATTERN = re.compile(r'=\s*(\(\s*[_$a-zA-Z0-9]+\s*\*.+?\)\s*%\s*.+?)\s*;')
    OBFUSCATED_SEED_PATTERN = re.compile(
        r'var\s+[_$a-zA-Z0-9]+\s*=\s*[^;]*?Number\s*\(\s*[_$a-zA-Z0-9]+\s*\)\s*,\s*([^,)]+?)\s*\)\s*,\s*([^,)]+?)\s*\)\s*,'
    )
    OBFUSCATED_LCG_PATTERN = re.compile(
        r'([_$a-zA-Z0-9]+)\s*=\s*[^;]*?\(\s*\1\s*,\s*([^,)]+?)\s*\)\s*,\s*([^,)]+?)\s*\)\s*,\s*([^;)]+?)\s*\)\s*;'
    )
    
    def __init__(self):
        self.template_cache = {}
    
    def parse_chapterlog_js(self, js_code):
        """解析chapterlog.js获取洗牌参数模板"""
        # 先尝试普通版本
        template = self._try_parse_plain(js_code)
        if template:
            return template
        # 再尝试混淆版本
        return self._try_parse_obfuscated(js_code)
    
    def _try_parse_plain(self, js):
        fixed_length_expr = extract_trailing_expression(js, self.FIXED_LENGTH_PATTERN, ')')
        seed_match = self.SEED_EXPR_PATTERN.search(js)
        lcg_match = self.LCG_EXPR_PATTERN.search(js)
        
        if not fixed_length_expr or not seed_match or not lcg_match:
            return None
        
        fixed_length = eval_int_expression(strip_outer_parentheses(fixed_length_expr))
        seed_params = self._parse_seed_expression(seed_match.group(1))
        lcg_params = self._parse_lcg_expression(lcg_match.group(1))
        
        if not fixed_length or not seed_params or not lcg_params:
            return None
        
        return {
            'fixedLength': fixed_length,
            'seedMultiplier': seed_params[0],
            'seedOffset': seed_params[1],
            'a': lcg_params[0],
            'c': lcg_params[1],
            'mod': lcg_params[2]
        }
    
    def _try_parse_obfuscated(self, js):
        seed_params = self._parse_obfuscated_seed(js)
        lcg_params = self._parse_obfuscated_lcg(js)
        
        if not seed_params or not lcg_params:
            return None
        
        return {
            'fixedLength': self.DEFAULT_FIXED_LENGTH,
            'seedMultiplier': seed_params[0],
            'seedOffset': seed_params[1],
            'a': lcg_params[0],
            'c': lcg_params[1],
            'mod': lcg_params[2]
        }
    
    def _parse_seed_expression(self, expr):
        """解析seed表达式: seed = chapterId * m + offset"""
        if not expr:
            return None
        
        # 代入chapterId=0求offset
        expr0 = re.sub(r'Number\s*\(\s*chapterId\s*\)', '0', expr)
        expr0 = re.sub(r'\bchapterId\b', '0', expr0)
        offset = eval_int_expression(expr0)
        
        # 代入chapterId=1求multiplier
        expr1 = re.sub(r'Number\s*\(\s*chapterId\s*\)', '1', expr)
        expr1 = re.sub(r'\bchapterId\b', '1', expr1)
        one_val = eval_int_expression(expr1)
        
        if offset is None or one_val is None:
            return None
        
        return (one_val - offset, offset)
    
    def _parse_obfuscated_seed(self, js):
        """解析混淆后的seed表达式"""
        for match in self.OBFUSCATED_SEED_PATTERN.finditer(js):
            multiplier = eval_int_expression(match.group(1))
            offset = eval_int_expression(match.group(2))
            if multiplier is not None and offset is not None and multiplier > 0 and offset >= 0:
                return (multiplier, offset)
        return None
    
    def _parse_lcg_expression(self, expr):
        """解析LCG表达式: seed = (seed * a + c) % mod"""
        if not expr:
            return None
        
        mod_parts = split_top_level(expr, '%')
        if len(mod_parts) != 2:
            return None
        
        mod = eval_int_expression(mod_parts[1])
        if mod is None:
            return None
        
        left = strip_outer_parentheses(mod_parts[0])
        var_name = first_identifier(left)
        if not var_name:
            return None
        
        # 代入变量=0求c
        expr0 = re.sub(r'Number\s*\(\s*' + var_name + r'\s*\)', '0', left)
        expr0 = re.sub(r'\b' + var_name + r'\b', '0', expr0)
        c = eval_int_expression(expr0)
        
        # 代入变量=1求a
        expr1 = re.sub(r'Number\s*\(\s*' + var_name + r'\s*\)', '1', left)
        expr1 = re.sub(r'\b' + var_name + r'\b', '1', expr1)
        one_val = eval_int_expression(expr1)
        
        if c is None or one_val is None:
            return None
        
        return (one_val - c, c, mod)
    
    def _parse_obfuscated_lcg(self, js):
        """解析混淆后的LCG表达式"""
        for match in self.OBFUSCATED_LCG_PATTERN.finditer(js):
            a = eval_int_expression(match.group(2))
            c = eval_int_expression(match.group(3))
            mod = eval_int_expression(match.group(4))
            if a is not None and c is not None and mod is not None:
                if a > 0 and c >= 0 and mod > a and mod > c:
                    return (a, c, mod)
        return None
    
    def get_shuffle_params(self, template, chapter_id):
        """根据章节ID生成洗牌参数"""
        return {
            'fixedLength': template['fixedLength'],
            'seed': chapter_id * template['seedMultiplier'] + template['seedOffset'],
            'a': template['a'],
            'c': template['c'],
            'mod': template['mod']
        }
    
    def restore_paragraphs(self, paragraphs, params):
        """
        还原被打乱的段落顺序 - 核心算法
        使用LCG(线性同余生成器)驱动的Fisher-Yates洗牌逆运算
        
        原理: 正向洗牌是 shuffled[i], shuffled[j] = shuffled[j], shuffled[i] (从后往前)
        还原时需要反向应用相同的交换序列，或者直接计算逆置换
        """
        n = len(paragraphs)
        if n <= 0:
            return paragraphs
        
        fixed_len = params['fixedLength']
        seed = params['seed']
        a = params['a']
        c = params['c']
        mod = params['mod']
        
        if n <= fixed_len:
            return paragraphs.copy()
        
        # 前fixed_len个段落固定不动，后面的被洗牌
        restored = paragraphs[:fixed_len]  # 前N个直接保留
        shuffled_part = paragraphs[fixed_len:]
        shuffled_len = len(shuffled_part)
        
        # 生成与JS完全一致的交换序列 (从后往前Fisher-Yates)
        shuffle_seed = seed
        swaps = []
        for i in range(shuffled_len - 1, 0, -1):
            shuffle_seed = (shuffle_seed * a + c) % mod
            j = int(shuffle_seed / mod * (i + 1))
            swaps.append((i, j))
        
        # 创建正向位置映射数组: 初始 arr[k] = k 表示位置k放的是原来第k个元素
        # 正向洗牌后，arr[k] = 原始索引 (即打乱后位置k放的是原来第arr[k]个元素)
        arr = list(range(shuffled_len))
        for i, j in swaps:
            arr[i], arr[j] = arr[j], arr[i]
        
        # 现在 arr[pos] = original_index
        # 即打乱后的第pos个段落 = 原始的第 arr[pos] 个段落
        # 所以: restored_shuffled[arr[pos]] = shuffled_part[pos]
        # 即: 原始第 arr[pos] 个位置 = 打乱后的第pos个段落
        restored_shuffled = [None] * shuffled_len
        for pos in range(shuffled_len):
            original_idx = arr[pos]
            restored_shuffled[original_idx] = shuffled_part[pos]
        
        return restored + restored_shuffled

# ==================== 爬虫主类 ====================
class BiliNovelCrawler:
    """哔哩轻小说爬虫主类"""
    
    def __init__(self, config=None):
        self.config = {**CONFIG, **(config or {})}
        self.session = self._create_session()
        self.limiter = RateLimiter(
            self.config['request_delay_min'],
            self.config['request_delay_max']
        )
        self.decryptor = BiliNovelDecryptor()
        self.chapterlog_cache = {}
        
        # 创建保存目录
        os.makedirs(self.config['save_dir'], exist_ok=True)
    
    def _create_session(self):
        """创建带重试机制的会话"""
        session = requests.Session()
        
        # 设置User-Agent
        if self.config['use_mobile_ua']:
            ua = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
        else:
            try:
                ua = UserAgent().random
            except:
                ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        
        session.headers.update({
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
            'Referer': self.config['domain'],
            'Cookie': 'night=0',
            'Connection': 'keep-alive',
        })
        
        # 重试策略
        retry_strategy = Retry(
            total=self.config['max_retries'],
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        
        return session
    
    def get(self, url, **kwargs):
        """带限流的GET请求"""
        self.limiter.wait()
        try:
            response = self.session.get(url, timeout=self.config['request_timeout'], **kwargs)
            response.raise_for_status()
            return response
        except Exception as e:
            print(f"[!] 请求失败: {url}, 错误: {e}")
            raise
    
    def get_novel_id(self, url):
        """从URL中提取小说ID"""
        match = re.search(r'(?:linovelib|bilinovel)\.com/(?:novel|download)/(\d+)', url)
        if match:
            return match.group(1)
        return None
    
    def get_novel_info(self, novel_id):
        """获取小说基本信息"""
        url = f"{self.config['domain']}/novel/{novel_id}.html"
        print(f"[*] 获取小说信息: {url}")
        
        response = self.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        novel = {
            'id': novel_id,
            'url': url,
            'title': '',
            'author': '',
            'cover': '',
            'tags': [],
            'status': '',
            'publisher': '',
            'description': '',
            'alias': '',
            'volumes': []
        }
        
        try:
            novel['title'] = soup.select_one('.book-title').get_text(strip=True)
            novel['author'] = soup.select_one('.book-rand-a span').get_text(strip=True)
            
            cover_img = soup.select_one('.book-layout img')
            if cover_img:
                novel['cover'] = self._normalize_url(cover_img.get('src', ''))
            
            tags = soup.select('.book-cell .book-meta span em')
            novel['tags'] = [t.get_text(strip=True) for t in tags]
            
            publisher_tag = soup.select_one('.tag-small.orange')
            if publisher_tag:
                novel['publisher'] = publisher_tag.get_text(strip=True)
            
            meta_items = soup.select('.book-cell .book-meta')
            if len(meta_items) >= 2:
                novel['status'] = list(meta_items[1].strings)[-1].strip()
            
            summary = soup.select_one('#bookSummary content')
            if summary:
                novel['description'] = summary.get_text(strip=True)
            
            alias_tag = soup.select_one('.backupname .bkname-body.gray')
            if alias_tag:
                novel['alias'] = alias_tag.get_text(strip=True)
                
        except Exception as e:
            print(f"[!] 解析小说信息出错: {e}")
        
        return novel
    
    def get_catalog(self, novel):
        """获取小说目录(分卷和章节)"""
        url = f"{self.config['domain']}/novel/{novel['id']}/catalog"
        print(f"[*] 获取目录: {url}")
        
        response = self.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        volumes = []
        current_volume = None
        
        items = soup.select('.volume-chapters > li')
        if not items:
            print("[!] 目录为空，可能需要检查页面结构")
            return volumes
        
        # 检查是否有卷标题
        has_chapter_bar = soup.select_one('.chapter-bar') is not None
        if not has_chapter_bar:
            current_volume = {
                'name': '',
                'cover': '',
                'chapters': []
            }
        
        for item in items:
            classes = item.get('class', [])
            
            if 'chapter-bar' in classes:
                if current_volume is not None:
                    volumes.append(current_volume)
                current_volume = {
                    'name': item.get_text(strip=True),
                    'cover': '',
                    'chapters': []
                }
            elif 'volume-cover' in classes:
                if current_volume:
                    img = item.select_one('a img')
                    if img:
                        current_volume['cover'] = self._normalize_url(img.get('src', ''))
            elif 'jsChapter' in classes and current_volume is not None:
                link = item.select_one('a')
                if link:
                    href = link.get('href', '')
                    if href and 'javascript' not in href:
                        chapter = {
                            'title': link.get_text(strip=True),
                            'url': self._normalize_url(href),
                            'content': '',
                            'images': []
                        }
                        current_volume['chapters'].append(chapter)
        
        if current_volume is not None:
            volumes.append(current_volume)
        
        novel['volumes'] = volumes
        return volumes
    
    def _normalize_url(self, url):
        """标准化URL"""
        if not url:
            return ''
        if url.startswith('//'):
            return 'https:' + url
        if url.startswith('/'):
            return self.config['domain'] + url
        if not url.startswith('http'):
            return self.config['domain'] + '/' + url
        url = url.replace('https://https://', 'https://')
        # 处理特殊Unicode字符
        url = url.replace('\ud835\ude23', 'b')
        return url
    
    def _get_chapterlog_template(self, script_url):
        """获取并解析chapterlog.js模板(带缓存)"""
        if script_url in self.chapterlog_cache:
            return self.chapterlog_cache[script_url]
        
        print(f"[*] 加载解密脚本: {script_url}")
        response = self.get(script_url)
        js_code = response.text
        
        template = self.decryptor.parse_chapterlog_js(js_code)
        if template:
            self.chapterlog_cache[script_url] = template
            print(f"[+] 解密参数解析成功: {template}")
        else:
            print("[!] 警告: 无法解析chapterlog.js，将尝试不解密下载")
        
        return template
    
    def get_chapter_content(self, chapter):
        """获取章节内容(自动翻页+解密)"""
        if not chapter.get('url'):
            return
        
        print(f"[*] 下载章节: {chapter['title']}")
        
        all_content_html = []
        all_images = []
        current_url = chapter['url']
        chapter_title = chapter['title']
        
        while current_url:
            response = self.get(current_url)
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 获取标题(仅第一页)
            title_tag = soup.select_one('#atitle')
            if title_tag and '_' not in current_url:
                page_title = title_tag.get_text(strip=True)
                if page_title and '〇' not in page_title:
                    chapter_title = page_title
            
            # 获取正文内容
            content = None
            for selector in ['#acontent', '.bcontent']:
                content = soup.select_one(selector)
                if content:
                    break
            
            if not content:
                print(f"[!] 无法找到内容区域: {current_url}")
                break
            
            # 检测是否需要解密
            script_tag = None
            for script in soup.find_all('script', src=True):
                src = script.get('src', '')
                if 'chapterlog.js?v' in src:
                    script_tag = script
                    break
            
            if script_tag:
                # 需要解密
                chapter_id_match = re.search(r"chapterid:'(\d+)'", response.text)
                if chapter_id_match:
                    chapter_id = int(chapter_id_match.group(1))
                    script_src = script_tag.get('src')
                    script_url = self._normalize_url(script_src)
                    
                    template = self._get_chapterlog_template(script_url)
                    if template:
                        params = self.decryptor.get_shuffle_params(template, chapter_id)
                        
                        # 提取有效段落
                        paragraphs = []
                        paragraph_slots = []
                        children = list(content.children)
                        
                        for idx, child in enumerate(children):
                            if getattr(child, 'name', None) == 'p':
                                p_html = child.decode_contents()
                                if re.sub(r'\s+', '', p_html):
                                    paragraphs.append(child)
                                    paragraph_slots.append(idx)
                        
                        if paragraphs:
                            # 执行还原
                            restored = self.decryptor.restore_paragraphs(paragraphs, params)
                            
                            # 重建内容
                            new_children = list(children)
                            for i, slot in enumerate(paragraph_slots):
                                new_children[slot] = restored[i]
                            
                            # 清空并重建content
                            content.clear()
                            for child in new_children:
                                if child is not None:
                                    content.append(child)
            
            # 清理无关元素
            for selector in ['div', 'ins', 'figure', 'fig', 'br', 'script', '.tp', '.bd']:
                for elem in content.select(selector):
                    elem.decompose()
            
            # 移除匹配特定class模式的广告
            for elem in content.find_all(class_=re.compile(r'[a-z]\d{4}')):
                elem.decompose()
            
            # 处理图片
            for img in content.find_all('img'):
                src = img.get('data-src') or img.get('src', '')
                src = self._normalize_url(src)
                
                if '<' in src:
                    img.decompose()
                    continue
                
                # 过滤无效属性
                allowed_attrs = {'alt', 'class', 'dir', 'height', 'id', 'ismap', 'lang', 
                               'longdesc', 'style', 'title', 'usemap', 'width', 'src'}
                for attr in list(img.attrs.keys()):
                    if attr not in allowed_attrs:
                        del img[attr]
                
                img['src'] = src
                img['alt'] = img.get('alt', '')
                all_images.append(src)
            
            # 收集内容HTML
            content_html = content.decode_contents()
            all_content_html.append(content_html)
            
            # 查找下一页
            nav_match = re.search(r"url_previous:'(.*?)',url_next:'(.*?)'", response.text)
            next_link = soup.select_one('#footlink a.nextlink')
            
            current_url = None
            if nav_match and next_link:
                next_text = next_link.get_text(strip=True)
                if next_text in ('下一页', '下一頁'):
                    next_url = nav_match.group(2)
                    if next_url:
                        current_url = self._normalize_url(next_url)
        
        chapter['title'] = chapter_title
        chapter['content'] = '\n'.join(all_content_html)
        chapter['images'] = all_images
    
    def download_image(self, url, save_path):
        """下载单张图片"""
        try:
            if url.startswith('data:image'):
                # Base64图片
                header, data = url.split(',', 1)
                img_data = base64.b64decode(data)
                with open(save_path, 'wb') as f:
                    f.write(img_data)
                return True
            
            response = self.get(url)
            with open(save_path, 'wb') as f:
                f.write(response.content)
            return True
        except Exception as e:
            print(f"[!] 图片下载失败: {url}, 错误: {e}")
            return False
    
    def download_novel(self, url_or_id, output_dir=None):
        """下载单本小说"""
        novel_id = url_or_id if url_or_id.isdigit() else self.get_novel_id(url_or_id)
        if not novel_id:
            print(f"[!] 无法识别小说ID: {url_or_id}")
            return None
        
        # 获取小说信息
        novel = self.get_novel_info(novel_id)
        print(f"\n[+] 小说: 《{novel['title']}》 作者: {novel['author']}")
        print(f"[+] 状态: {novel['status']} 标签: {', '.join(novel['tags'][:3])}")
        
        # 创建保存目录
        if output_dir is None:
            safe_title = re.sub(r'[\\/*?:"<>|]', '_', novel['title'])
            output_dir = os.path.join(self.config['save_dir'], safe_title)
        os.makedirs(output_dir, exist_ok=True)
        novel['save_dir'] = output_dir
        
        # 获取目录
        volumes = self.get_catalog(novel)
        total_chapters = sum(len(v['chapters']) for v in volumes)
        print(f"[+] 共 {len(volumes)} 卷, {total_chapters} 章")
        
        # 下载封面
        if novel['cover']:
            cover_ext = os.path.splitext(urlparse(novel['cover']).path)[1] or '.jpg'
            cover_path = os.path.join(output_dir, f'cover{cover_ext}')
            if not os.path.exists(cover_path):
                self.download_image(novel['cover'], cover_path)
            novel['cover_path'] = cover_path
        
        # 创建图片目录
        image_dir = os.path.join(output_dir, self.config['image_dir_name'])
        if self.config['download_images']:
            os.makedirs(image_dir, exist_ok=True)
        
        # 下载每一章
        chapter_count = 0
        for vol_idx, volume in enumerate(volumes, 1):
            vol_name = volume['name'] or f'第{vol_idx}卷'
            safe_vol_name = re.sub(r'[\\/*?:"<>|]', '_', vol_name)
            vol_dir = os.path.join(output_dir, safe_vol_name)
            os.makedirs(vol_dir, exist_ok=True)
            
            # 下载卷封面
            if volume.get('cover') and self.config['download_images']:
                vol_cover_ext = os.path.splitext(urlparse(volume['cover']).path)[1] or '.jpg'
                vol_cover_path = os.path.join(vol_dir, f'volume_cover{vol_cover_ext}')
                if not os.path.exists(vol_cover_path):
                    self.download_image(volume['cover'], vol_cover_path)
            
            print(f"\n[=] 第{vol_idx}卷: {vol_name} ({len(volume['chapters'])}章)")
            
            for chap_idx, chapter in enumerate(volume['chapters'], 1):
                chapter_count += 1
                try:
                    self.get_chapter_content(chapter)
                    
                    # 下载章节图片
                    if self.config['download_images'] and chapter['images']:
                        chap_img_dir = os.path.join(image_dir, f'vol{vol_idx}_chap{chap_idx}')
                        os.makedirs(chap_img_dir, exist_ok=True)
                        
                        for img_idx, img_url in enumerate(chapter['images']):
                            img_ext = os.path.splitext(urlparse(img_url).path)[1] or '.jpg'
                            img_name = f'{img_idx:03d}{img_ext}'
                            img_path = os.path.join(chap_img_dir, img_name)
                            if not os.path.exists(img_path):
                                self.download_image(img_url, img_path)
                            
                            # 替换HTML中的图片路径为本地路径
                            rel_path = os.path.relpath(img_path, vol_dir)
                            chapter['content'] = chapter['content'].replace(
                                img_url, rel_path.replace('\\', '/')
                            )
                    
                    # 保存单章TXT
                    if 'txt' in self.config['output_format']:
                        self._save_chapter_txt(chapter, vol_dir, chap_idx)
                    
                    print(f"    [{chapter_count}/{total_chapters}] ✓ {chapter['title']}")
                    
                except Exception as e:
                    print(f"    [{chapter_count}/{total_chapters}] ✗ {chapter['title']} - 错误: {e}")
                    chapter['content'] = f"[下载失败: {e}]"
        
        # 导出整本小说
        if 'txt' in self.config['output_format']:
            self._save_novel_txt(novel)
        
        if 'epub' in self.config['output_format']:
            self._save_novel_epub(novel)
        
        # 保存元数据
        meta_path = os.path.join(output_dir, 'meta.json')
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(novel, f, ensure_ascii=False, indent=2, default=str)
        
        print(f"\n[√] 下载完成! 保存位置: {output_dir}")
        return novel
    
    def _html_to_text(self, html):
        """HTML转纯文本"""
        soup = BeautifulSoup(html, 'html.parser')
        # 处理图片
        for img in soup.find_all('img'):
            alt = img.get('alt', '')
            src = img.get('src', '')
            if alt or src:
                img.replace_with(f'\n[插图: {alt or src}]\n')
            else:
                img.decompose()
        # 处理段落
        text = soup.get_text('\n', strip=True)
        # 清理空行
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text
    
    def _save_chapter_txt(self, chapter, vol_dir, chap_idx):
        """保存单章为TXT"""
        safe_title = re.sub(r'[\\/*?:"<>|]', '_', chapter['title'])
        filename = f'{chap_idx:04d}_{safe_title}.txt'
        filepath = os.path.join(vol_dir, filename)
        
        text = self._html_to_text(chapter['content'])
        content = f"{chapter['title']}\n\n{text}\n"
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def _save_novel_txt(self, novel):
        """保存整本小说为TXT"""
        safe_title = re.sub(r'[\\/*?:"<>|]', '_', novel['title'])
        filepath = os.path.join(novel['save_dir'], f'{safe_title}.txt')
        
        lines = []
        lines.append(novel['title'])
        lines.append('')
        lines.append(f"作者: {novel['author']}")
        lines.append(f"状态: {novel['status']}")
        if novel['tags']:
            lines.append(f"标签: {', '.join(novel['tags'])}")
        lines.append('')
        lines.append('=' * 50)
        lines.append('')
        
        for volume in novel['volumes']:
            if volume['name']:
                lines.append(volume['name'])
                lines.append('')
            
            for chapter in volume['chapters']:
                lines.append(chapter['title'])
                lines.append('')
                text = self._html_to_text(chapter['content'])
                lines.append(text)
                lines.append('')
                lines.append('-' * 30)
                lines.append('')
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        print(f"[+] TXT已保存: {filepath}")
    
    def _save_novel_epub(self, novel):
        """保存为EPUB格式"""
        try:
            safe_title = re.sub(r'[\\/*?:"<>|]', '_', novel['title'])
            epub_path = os.path.join(novel['save_dir'], f'{safe_title}.epub')
            
            # EPUB本质是ZIP文件
            with zipfile.ZipFile(epub_path, 'w', zipfile.ZIP_DEFLATED) as epub:
                # mimetype文件(必须第一个且不压缩)
                epub.writestr('mimetype', 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
                
                # META-INF/container.xml
                container_xml = '''<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>'''
                epub.writestr('META-INF/container.xml', container_xml)
                
                # OEBPS目录
                oebps = 'OEBPS/'
                
                # 添加封面图片
                cover_id = ''
                if novel.get('cover_path') and os.path.exists(novel['cover_path']):
                    cover_ext = os.path.splitext(novel['cover_path'])[1]
                    cover_href = f'images/cover{cover_ext}'
                    epub.write(novel['cover_path'], oebps + cover_href)
                    cover_id = 'cover-img'
                
                # CSS样式
                css = '''body { margin: 5%; text-align: justify; }
h1 { text-align: center; margin: 2em 0; }
h2 { margin-top: 3em; }
p { text-indent: 2em; margin: 0.5em 0; line-height: 1.6; }
img { max-width: 100%; display: block; margin: 1em auto; }'''
                epub.writestr(oebps + 'style.css', css)
                
                # 生成manifest和spine
                manifest = []
                spine = []
                chapter_files = []
                
                # 封面页
                cover_html = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>封面</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body style="text-align:center;">
<h1>{novel['title']}</h1>
<p>作者: {novel['author']}</p>
<img src="images/cover{os.path.splitext(novel.get('cover_path', ''))[1]}" alt="封面"/>
</body></html>'''
                epub.writestr(oebps + 'cover.xhtml', cover_html)
                manifest.append('<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>')
                spine.append('<itemref idref="cover"/>')
                
                # 目录页
                toc_items = []
                chap_num = 1
                for vol_idx, volume in enumerate(novel['volumes']):
                    if volume['name']:
                        toc_items.append(f'<p style="text-align:center;font-weight:bold;margin-top:2em;">{volume["name"]}</p>')
                    for chapter in volume['chapters']:
                        chap_file = f'chapter{chap_num:04d}.xhtml'
                        toc_items.append(f'<p><a href="{chap_file}">{chapter["title"]}</a></p>')
                        
                        # 章节HTML
                        chap_html = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>{chapter['title']}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<h2>{chapter['title']}</h2>
{chapter['content']}
</body></html>'''
                        epub.writestr(oebps + chap_file, chap_html)
                        
                        item_id = f'chap{chap_num}'
                        manifest.append(f'<item id="{item_id}" href="{chap_file}" media-type="application/xhtml+xml"/>')
                        spine.append(f'<itemref idref="{item_id}"/>')
                        chapter_files.append((chap_num, chapter['title'], chap_file))
                        chap_num += 1
                
                toc_html = f'''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>目录</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<h1>目录</h1>
{''.join(toc_items)}
</body></html>'''
                epub.writestr(oebps + 'toc.xhtml', toc_html)
                manifest.append('<item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>')
                spine.insert(1, '<itemref idref="toc"/>')
                
                # 添加CSS
                manifest.append('<item id="css" href="style.css" media-type="text/css"/>')
                
                # 添加图片到manifest
                img_id = 1
                if cover_id:
                    manifest.append(f'<item id="{cover_id}" href="{cover_href}" media-type="image/jpeg"/>')
                
                # OPF文件
                opf = f'''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>{novel['title']}</dc:title>
    <dc:creator>{novel['author']}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:identifier id="BookId">bilinovel-{novel['id']}</dc:identifier>
  </metadata>
  <manifest>
    {''.join(manifest)}
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    {''.join(spine)}
  </spine>
</package>'''
                epub.writestr(oebps + 'content.opf', opf)
                
                # NCX目录
                nav_points = []
                for num, title, href in chapter_files:
                    nav_points.append(f'''<navPoint id="nav{num}" playOrder="{num}">
  <navLabel><text>{title}</text></navLabel>
  <content src="{href}"/>
</navPoint>''')
                
                ncx = f'''<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:depth" content="1"/></head>
  <docTitle><text>{novel['title']}</text></docTitle>
  <navMap>{''.join(nav_points)}</navMap>
</ncx>'''
                epub.writestr(oebps + 'toc.ncx', ncx)
            
            print(f"[+] EPUB已保存: {epub_path}")
        except Exception as e:
            print(f"[!] EPUB生成失败: {e}")
    
    def get_category_list(self, category_url=None, page=1):
        """获取分类页小说列表"""
        if category_url is None:
            category_url = f"{self.config['domain']}/novel/0_{page}.html"
        
        response = self.get(category_url)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        novels = []
        for item in soup.select('.book-li'):
            link = item.select_one('a.book-a')
            if link:
                href = link.get('href', '')
                novel_id = self.get_novel_id(self._normalize_url(href))
                title_tag = item.select_one('.book-title')
                title = title_tag.get_text(strip=True) if title_tag else ''
                
                if novel_id:
                    novels.append({
                        'id': novel_id,
                        'title': title,
                        'url': self._normalize_url(href)
                    })
        
        return novels
    
    def crawl_all(self, start_page=1, max_novels=0):
        """爬取全站小说"""
        print(f"[*] 开始全站爬取，从第{start_page}页开始")
        novel_count = 0
        page = start_page
        
        while True:
            print(f"\n[=] 正在处理第 {page} 页")
            try:
                novels = self.get_category_list(page=page)
                if not novels:
                    print("[*] 没有更多小说了")
                    break
                
                for novel_info in novels:
                    if max_novels > 0 and novel_count >= max_novels:
                        print(f"[*] 已达到最大爬取数量{max_novels}，停止")
                        return
                    
                    try:
                        print(f"\n[{novel_count + 1}] 正在下载: {novel_info['title']}")
                        self.download_novel(novel_info['id'])
                        novel_count += 1
                    except Exception as e:
                        print(f"[!] 下载失败 {novel_info['title']}: {e}")
                
                page += 1
                
            except Exception as e:
                print(f"[!] 第{page}页处理出错: {e}")
                page += 1

# ==================== 主程序 ====================
def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='哔哩轻小说(bilinovel.com)全站爬虫 - 含完美逆向解密')
    parser.add_argument('-u', '--url', help='小说URL或ID')
    parser.add_argument('-a', '--all', action='store_true', help='爬取全站所有小说')
    parser.add_argument('-p', '--page', type=int, default=1, help='起始页码(全站爬取)')
    parser.add_argument('-m', '--max', type=int, default=0, help='最大爬取小说数(0=不限制)')
    parser.add_argument('--no-image', action='store_true', help='不下载图片')
    parser.add_argument('--txt-only', action='store_true', help='仅保存TXT格式')
    parser.add_argument('--fast', action='store_true', help='快速模式(减少延迟)')
    
    args = parser.parse_args()
    
    # 配置
    config = {}
    if args.no_image:
        config['download_images'] = False
    if args.txt_only:
        config['output_format'] = ['txt']
    if args.fast:
        config['request_delay_min'] = 0.5
        config['request_delay_max'] = 1.5
    
    crawler = BiliNovelCrawler(config)
    
    print("=" * 60)
    print("哔哩轻小说(bilinovel.com)全站爬虫 v1.0")
    print("包含完美逆向解密: 段落乱序还原算法")
    print("=" * 60)
    
    if args.url:
        # 单本下载
        crawler.download_novel(args.url)
    elif args.all:
        # 全站爬取
        crawler.crawl_all(start_page=args.page, max_novels=args.max)
    else:
        # 交互模式
        print("\n请选择模式:")
        print("1. 下载单本小说")
        print("2. 爬取全站小说")
        choice = input("输入选项(1/2): ").strip()
        
        if choice == '1':
            url = input("请输入小说URL或ID: ").strip()
            if url:
                crawler.download_novel(url)
        elif choice == '2':
            start_page = int(input("起始页码(默认1): ").strip() or '1')
            max_novels = int(input("最大下载数量(0=不限制): ").strip() or '0')
            crawler.crawl_all(start_page=start_page, max_novels=max_novels)
        else:
            print("无效选项")

if __name__ == '__main__':
    main()
