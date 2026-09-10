#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
独立的M3U8视频解密下载工具
功能：
1. 支持AES-128-CBC加密M3U8自动解密
2. 支持自定义Key和IV
3. 多线程高速下载
4. 断点续传
5. 自动合并为MP4
"""

import os
import re
import sys
import time
import base64
import random
import argparse
import binascii
from urllib.parse import urljoin
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import m3u8
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
from tqdm import tqdm


class M3U8Downloader:
    def __init__(self, max_workers=15, timeout=30):
        self.max_workers = max_workers
        self.timeout = timeout
        self.session = requests.Session()
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ]
        self.headers = {
            'User-Agent': random.choice(self.user_agents),
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        }
    
    def set_referer(self, referer):
        self.headers['Referer'] = referer
    
    def decrypt_aes128(self, data, key, iv=None):
        """AES-128-CBC解密"""
        try:
            if isinstance(iv, str):
                iv = iv.replace('0x', '')
                iv = binascii.unhexlify(iv.zfill(32))
            cipher = AES.new(key, AES.MODE_CBC, iv=iv)
            decrypted = cipher.decrypt(data)
            # 去除PKCS7填充
            pad_len = decrypted[-1]
            if 1 <= pad_len <= 16:
                decrypted = decrypted[:-pad_len]
            return decrypted
        except Exception as e:
            print(f"解密失败: {e}")
            return data
    
    def download_segment(self, url, save_path, key=None, iv=None, retries=3):
        """下载单个TS片段"""
        for i in range(retries):
            try:
                resp = self.session.get(url, headers=self.headers, 
                                       timeout=self.timeout, stream=True)
                if resp.status_code == 200:
                    data = resp.content
                    
                    # 如果有密钥，解密
                    if key:
                        data = self.decrypt_aes128(data, key, iv)
                    
                    with open(save_path, 'wb') as f:
                        f.write(data)
                    return True
            except Exception as e:
                if i == retries - 1:
                    print(f"片段下载失败 {url}: {e}")
                    return False
                time.sleep(1)
        return False
    
    def download(self, m3u8_url, output_path=None, key=None, iv=None):
        """下载M3U8视频"""
        print(f"正在解析M3U8: {m3u8_url}")
        
        # 创建临时目录
        if not output_path:
            output_path = 'output.mp4'
        
        output_dir = os.path.dirname(os.path.abspath(output_path))
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        ts_dir = output_path + '_ts_temp'
        os.makedirs(ts_dir, exist_ok=True)
        
        # 加载M3U8
        try:
            m3u8_obj = m3u8.load(m3u8_url, headers=self.headers)
        except Exception as e:
            print(f"加载M3U8失败: {e}")
            return False
        
        # 处理Master M3U8（多级码率）
        if m3u8_obj.is_variant:
            print(f"检测到多码率视频，共 {len(m3u8_obj.playlists)} 个流")
            # 选择最高画质
            best_playlist = max(m3u8_obj.playlists, key=lambda x: x.stream_info.bandwidth if x.stream_info else 0)
            new_url = urljoin(m3u8_url, best_playlist.uri)
            print(f"选择最高码率: {best_playlist.stream_info.bandwidth if best_playlist.stream_info else 'N/A'} bps")
            print(f"切换到: {new_url}")
            return self.download(new_url, output_path, key, iv)
        
        segments = m3u8_obj.segments
        if not segments:
            print("未找到视频片段")
            return False
        
        print(f"视频片段总数: {len(segments)}")
        
        # 获取加密密钥
        if not key and m3u8_obj.keys and m3u8_obj.keys[0]:
            key_obj = m3u8_obj.keys[0]
            if key_obj and key_obj.uri and key_obj.method == 'AES-128':
                key_url = urljoin(m3u8_url, key_obj.uri)
                print(f"正在获取解密密钥: {key_url}")
                try:
                    key_resp = self.session.get(key_url, headers=self.headers, timeout=30)
                    key = key_resp.content
                    print(f"密钥获取成功: {key.hex()}")
                except Exception as e:
                    print(f"获取密钥失败: {e}")
                    return False
            
            if not iv and key_obj.iv:
                iv = key_obj.iv
        
        if key:
            print("视频已加密，将自动解密")
        
        # 准备下载
        ts_files = []
        failed_segments = []
        
        print(f"\n开始下载，使用 {self.max_workers} 线程...")
        time.sleep(1)
        
        # 多线程下载
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {}
            for i, seg in enumerate(segments):
                seg_url = urljoin(m3u8_url, seg.uri) if not seg.uri.startswith('http') else seg.uri
                ts_file = os.path.join(ts_dir, f"segment_{i:06d}.ts")
                
                # 计算IV（如果M3U8中没有指定，使用序列号）
                seg_iv = iv if iv else i.to_bytes(16, byteorder='big')
                
                if not os.path.exists(ts_file) or os.path.getsize(ts_file) == 0:
                    future = executor.submit(
                        self.download_segment, seg_url, ts_file, key, seg_iv
                    )
                    futures[future] = (i, ts_file)
                else:
                    ts_files.append((i, ts_file))
            
            # 进度条
            with tqdm(total=len(futures), desc="下载进度") as pbar:
                for future in as_completed(futures):
                    i, ts_file = futures[future]
                    try:
                        success = future.result()
                        if success:
                            ts_files.append((i, ts_file))
                        else:
                            failed_segments.append(i)
                    except Exception as e:
                        failed_segments.append(i)
                    pbar.update(1)
        
        if failed_segments:
            print(f"\n警告: {len(failed_segments)} 个片段下载失败: {failed_segments[:10]}...")
        
        # 排序合并
        ts_files.sort(key=lambda x: x[0])
        
        print(f"\n正在合并为MP4文件: {output_path}")
        with open(output_path, 'wb') as out_f:
            for i, ts_file in ts_files:
                if os.path.exists(ts_file):
                    with open(ts_file, 'rb') as ts_f:
                        out_f.write(ts_f.read())
        
        # 清理临时文件
        import shutil
        try:
            shutil.rmtree(ts_dir)
        except:
            pass
        
        file_size = os.path.getsize(output_path) / (1024 * 1024)
        print(f"\n✅ 下载完成!")
        print(f"文件路径: {os.path.abspath(output_path)}")
        print(f"文件大小: {file_size:.2f} MB")
        
        return True


def decrypt_js_file(js_file_path):
    """解密本地JS文件"""
    try:
        with open(js_file_path, 'r', encoding='utf-8', errors='ignore') as f:
            js_code = f.read()
        
        print(f"正在解密JS文件: {js_file_path}")
        
        # 这里可以导入主爬虫的解密工具
        from wbtvs_spider import JSDecryptor
        
        decryptor = JSDecryptor()
        decrypted = decryptor.multi_decrypt(js_code)
        
        # 提取URL
        urls, _ = decryptor.extract_m3u8_urls(decrypted)
        
        output_path = js_file_path + '.decrypted.js'
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(decrypted)
        
        print(f"解密完成，保存到: {output_path}")
        
        if urls:
            print(f"\n找到视频地址:")
            for url in urls:
                print(f"  - {url}")
        else:
            print("\n未找到明确的视频地址，请查看解密后的JS文件")
        
        return decrypted, urls
        
    except Exception as e:
        print(f"解密失败: {e}")
        import traceback
        traceback.print_exc()
        return None, None


def main():
    parser = argparse.ArgumentParser(description='M3U8视频解密下载工具')
    parser.add_argument('url', nargs='?', help='M3U8视频地址')
    parser.add_argument('-o', '--output', default='output.mp4', help='输出文件名 (默认: output.mp4)')
    parser.add_argument('-k', '--key', help='自定义解密密钥 (hex或base64)')
    parser.add_argument('--iv', help='自定义IV (hex)')
    parser.add_argument('-r', '--referer', help='自定义Referer')
    parser.add_argument('-w', '--workers', type=int, default=15, help='下载线程数')
    parser.add_argument('--decrypt-js', help='解密JS文件并提取视频地址')
    parser.add_argument('--key-from-file', help='从文件读取密钥')
    
    args = parser.parse_args()
    
    if args.decrypt_js:
        decrypt_js_file(args.decrypt_js)
        return
    
    if not args.url:
        parser.print_help()
        print("\n使用示例:")
        print("  1. 直接下载M3U8视频（自动解析解密）:")
        print("     python m3u8_decryptor.py https://example.com/video.m3u8 -o 电影名.mp4")
        print("\n  2. 指定Referer绕过防盗链:")
        print("     python m3u8_decryptor.py https://example.com/video.m3u8 -r https://www.wbtvs.cc/")
        print("\n  3. 使用自定义密钥解密:")
        print("     python m3u8_decryptor.py https://example.com/video.m3u8 -k abcdef1234567890abcdef1234567890")
        print("\n  4. 解密播放器JS并提取地址:")
        print("     python m3u8_decryptor.py --decrypt-js player.js")
        return
    
    downloader = M3U8Downloader(max_workers=args.workers)
    
    if args.referer:
        downloader.set_referer(args.referer)
    
    # 处理密钥
    key = None
    iv = None
    
    if args.key_from_file:
        with open(args.key_from_file, 'rb') as f:
            key = f.read()
    elif args.key:
        try:
            # 尝试hex解析
            key = binascii.unhexlify(args.key)
        except:
            try:
                # 尝试base64
                key = base64.b64decode(args.key)
            except:
                key = args.key.encode()
    
    if args.iv:
        try:
            iv = binascii.unhexlify(args.iv.replace('0x', ''))
        except:
            iv = args.iv.encode()
    
    success = downloader.download(args.url, args.output, key, iv)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    print("""
╔═══════════════════════════════════════════════╗
║       M3U8 视频解密下载工具 v1.0              ║
║   支持 AES-128-CBC 自动解密 & 多线程下载       ║
╚═══════════════════════════════════════════════╝
    """)
    main()
