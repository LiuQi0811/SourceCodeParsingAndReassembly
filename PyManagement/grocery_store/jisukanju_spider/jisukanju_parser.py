#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
极速看剧 播放页解析 & M3U8 地址提取工具
用于解析播放页面，获取真实的视频播放地址（m3u8/mp4）

使用方法：
    python jisukanju_parser.py <播放页URL>
    python jisukanju_parser.py --batch urls.txt   # 批量解析
"""

import re
import os
import sys
import json
import time
import base64
import argparse
from urllib.parse import urljoin, unquote

import requests
from bs4 import BeautifulSoup
import warnings
warnings.filterwarnings('ignore')

BASE_URL = "https://www.jisukanju.com"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Referer': BASE_URL,
}

OUTPUT_DIR = "jisukanju_data"
os.makedirs(OUTPUT_DIR, exist_ok=True)


class PlayPageParser:
    """播放页解析器，提取真实视频地址"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.session.verify = False
    
    def _request(self, url, timeout=20):
        try:
            r = self.session.get(url, timeout=timeout)
            r.encoding = 'utf-8'
            return r.text
        except Exception as e:
            print(f"[-] 请求失败 {url}: {e}")
            return None
    
    def base64_decode(self, text):
        """MacCMS常见的base64解码"""
        try:
            # 补全padding
            padding = 4 - len(text) % 4
            if padding != 4:
                text += '=' * padding
            decoded = base64.b64decode(text).decode('utf-8', errors='ignore')
            return decoded
        except:
            return None
    
    def parse_player_config(self, html):
        """解析MacCMS播放器配置，提取视频地址"""
        results = {
            'player_url': None,
            'video_url': None,
            'video_type': None,
            'from': None,
            'next_url': None,
            'raw_config': {}
        }
        
        if not html:
            return results
        
        # 1. 查找 player_aaaa 配置 (MacCMS最常见)
        player_aaaa = re.search(r'var\s+player_aaaa\s*=\s*(\{[^}]+\})', html)
        if player_aaaa:
            try:
                config_str = player_aaaa.group(1)
                # 提取URL字段
                url_match = re.search(r'url\s*:\s*[\'\"]([^\'\"]+)', config_str)
                if url_match:
                    enc_url = url_match.group(1)
                    # 尝试base64解码
                    decoded = self.base64_decode(enc_url)
                    if decoded and (decoded.startswith('http') or decoded.startswith('/')):
                        results['video_url'] = decoded if decoded.startswith('http') else urljoin(BASE_URL, decoded)
                    else:
                        results['video_url'] = enc_url
                
                # 提取from字段
                from_match = re.search(r'from\s*:\s*[\'\"]([^\'\"]+)', config_str)
                if from_match:
                    results['from'] = from_match.group(1)
                
                # 提取next字段
                next_match = re.search(r'next\s*:\s*[\'\"]([^\'\"]+)', config_str)
                if next_match:
                    results['next_url'] = next_match.group(1)
                
                results['raw_config']['player_aaaa'] = config_str
            except:
                pass
        
        # 2. 查找 mac_url / mac_play
        mac_url = re.search(r'(?:mac_url|play_url|video_url)\s*=\s*[\'\"]([^\'\"]+)', html)
        if mac_url and not results['video_url']:
            url = mac_url.group(1)
            if url.startswith('http'):
                results['video_url'] = url
        
        # 3. 查找iframe嵌套播放器
        iframe = re.search(r'<iframe[^>]+src=[\'\"]([^\'\"]+)[\'\"]', html)
        if iframe:
            iframe_url = iframe.group(1)
            if not iframe_url.startswith('http'):
                iframe_url = urljoin(BASE_URL, iframe_url)
            results['player_url'] = iframe_url
            
            # 如果是站内播放器，再递归解析
            if BASE_URL in iframe_url or '/player/' in iframe_url or '/play/' in iframe_url:
                iframe_html = self._request(iframe_url)
                if iframe_html:
                    sub_result = self.parse_player_config(iframe_html)
                    if sub_result['video_url']:
                        results['video_url'] = sub_result['video_url']
                        results['raw_config']['iframe_parsed'] = True
        
        # 4. 直接在script中搜索m3u8/mp4地址
        if not results['video_url']:
            video_patterns = [
                r'https?://[^\s\'\"<>]+\.m3u8[^\s\'\"<>]*',
                r'https?://[^\s\'\"<>]+\.mp4[^\s\'\"<>]*',
                r'https?://[^\s\'\"<>]+\.mkv[^\s\'\"<>]*',
            ]
            for pattern in video_patterns:
                matches = re.findall(pattern, html)
                if matches:
                    results['video_url'] = matches[0]
                    break
        
        # 判断视频类型
        if results['video_url']:
            url_lower = results['video_url'].lower()
            if '.m3u8' in url_lower:
                results['video_type'] = 'hls/m3u8'
            elif '.mp4' in url_lower:
                results['video_type'] = 'mp4'
            elif '.mkv' in url_lower:
                results['video_type'] = 'mkv'
            else:
                results['video_type'] = 'unknown'
        
        return results
    
    def parse_play_page(self, play_url):
        """解析单个播放页"""
        print(f"\n[*] 解析播放页: {play_url}")
        
        html = self._request(play_url)
        if not html:
            return None
        
        # 获取集数信息
        soup = BeautifulSoup(html, 'lxml')
        title = ''
        title_tag = soup.find('h1') or soup.find('h2') or soup.title
        if title_tag:
            title = title_tag.get_text(strip=True)
        
        result = self.parse_player_config(html)
        result['title'] = title
        result['page_url'] = play_url
        
        print(f"    标题: {title}")
        print(f"    播放源: {result['from']}")
        print(f"    视频类型: {result['video_type']}")
        print(f"    视频地址: {result['video_url']}")
        if result['player_url']:
            print(f"    嵌套播放器: {result['player_url']}")
        
        return result
    
    def parse_all_episodes(self, detail_url):
        """解析一个详情页的所有剧集播放地址"""
        print(f"\n{'='*60}")
        print(f"[*] 批量解析详情页所有剧集: {detail_url}")
        
        from jisukanju_spider import JiSuKanJuSpider
        spider = JiSuKanJuSpider()
        vid_match = re.search(r'id/(\d+)', detail_url)
        vid = vid_match.group(1) if vid_match else 'unknown'
        
        html = spider._request(detail_url)
        video_info = spider.parse_detail_page(html, detail_url, vid)
        
        if not video_info:
            print("[-] 无法获取详情页信息")
            return
        
        print(f"[+] 视频: {video_info['title']}")
        print(f"[+] 共 {sum(len(eps) for eps in video_info['play_sources'].values())} 个播放链接\n")
        
        all_results = []
        for source_name, episodes in video_info['play_sources'].items():
            print(f"\n--- {source_name} ---")
            for ep in episodes:
                time.sleep(1)  # 防止请求过快
                result = self.parse_play_page(ep['url'])
                if result:
                    result['source'] = source_name
                    result['episode'] = ep['name']
                    all_results.append(result)
        
        # 保存结果
        output_file = os.path.join(OUTPUT_DIR, f"episodes_{vid}.json")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_results, f, ensure_ascii=False, indent=2)
        print(f"\n[+] 所有剧集解析完成，已保存: {output_file}")
        
        return all_results


def main():
    parser = argparse.ArgumentParser(description='极速看剧播放地址解析工具')
    parser.add_argument('url', nargs='?', help='播放页或详情页URL')
    parser.add_argument('--batch', help='批量解析文件（每行一个URL）')
    parser.add_argument('--all', action='store_true', help='解析详情页下所有剧集')
    
    args = parser.parse_args()
    
    print("""
╔═══════════════════════════════════════════════════╗
║        极速看剧 播放地址解析 & M3U8提取工具        ║
╚═══════════════════════════════════════════════════╝
    """)
    
    p = PlayPageParser()
    
    if args.batch:
        if not os.path.exists(args.batch):
            print(f"[-] 文件不存在: {args.batch}")
            return
        with open(args.batch, 'r') as f:
            urls = [line.strip() for line in f if line.strip()]
        print(f"[*] 批量解析 {len(urls)} 个URL")
        results = []
        for url in urls:
            r = p.parse_play_page(url)
            if r:
                results.append(r)
            time.sleep(1)
        # 保存批量结果
        out_file = os.path.join(OUTPUT_DIR, "batch_parse_result.json")
        with open(out_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f"\n[+] 批量解析完成: {out_file}")
    
    elif args.url:
        if args.all:
            p.parse_all_episodes(args.url)
        else:
            p.parse_play_page(args.url)
    else:
        parser.print_help()
        print("\n示例:")
        print("  python jisukanju_parser.py https://www.jisukanju.com/vod/play/id/12345.html")
        print("  python jisukanju_parser.py https://www.jisukanju.com/vod/detail/id/12345.html --all")
        print("  python jisukanju_parser.py --batch urls.txt")


if __name__ == '__main__':
    main()
