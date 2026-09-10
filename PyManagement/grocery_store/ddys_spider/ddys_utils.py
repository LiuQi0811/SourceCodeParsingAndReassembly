#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ddys.io 数据导出和辅助工具
功能：
1. 将JSON数据导出为CSV表格
2. 批量下载m3u8视频（支持选择源和集数）
3. 提取所有网盘链接
"""

import os
import sys
import json
import csv
import argparse
import subprocess
from pathlib import Path
from urllib.parse import urlparse

def safe_filename(name):
    import re
    name = re.sub(r'[<>:"/\\|?*]', '_', name)
    name = re.sub(r'\s+', '_', name)
    return name[:100]

def export_to_csv(json_file, csv_file=None):
    """导出JSON数据为CSV表格"""
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 兼容单个对象和数组两种格式
    if isinstance(data, dict):
        data = [data]
    
    if csv_file is None:
        csv_file = Path(json_file).with_suffix('.csv')
    
    rows = []
    for movie in data:
        sources_count = len(movie.get('video_sources', []))
        total_episodes = sum(s.get('episode_count', 0) for s in movie.get('video_sources', []))
        netdisk_count = len(movie.get('netdisk_resources', []))
        
        # 获取第一个源的第一个视频URL
        first_video_url = ''
        if movie.get('video_sources') and movie['video_sources'][0].get('episodes'):
            first_video_url = movie['video_sources'][0]['episodes'][0].get('url', '')
        
        rows.append({
            'ID': movie.get('movie_id', ''),
            '标题': movie.get('title', ''),
            '年份': movie.get('year', ''),
            '评分': movie.get('rating', ''),
            '分类': movie.get('category', ''),
            '播放源数': sources_count,
            '总集数': total_episodes,
            '网盘数': netdisk_count,
            '海报': movie.get('poster', ''),
            '链接': movie.get('url', ''),
            '首个视频URL': first_video_url,
        })
    
    with open(csv_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys() if rows else [])
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"已导出 {len(rows)} 条记录到 {csv_file}")
    return csv_file

def export_netdisk_links(json_file, output_file=None):
    """导出所有网盘链接"""
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 兼容单个对象和数组两种格式
    if isinstance(data, dict):
        data = [data]
    
    if output_file is None:
        output_file = Path(json_file).parent / "netdisk_links.txt"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("低端影视网盘资源汇总\n")
        f.write("=" * 80 + "\n\n")
        
        type_names = {
            'quark': '夸克网盘',
            'baidu': '百度网盘',
            'xunlei': '迅雷网盘',
            'aliyun': '阿里云盘'
        }
        
        for movie in data:
            title = movie.get('title', '未知')
            sources = movie.get('netdisk_resources', [])
            if not sources:
                continue
            
            f.write(f"【{title}】\n")
            f.write(f"链接: {movie.get('url', '')}\n")
            for nd in sources:
                type_name = type_names.get(nd['type'], nd['type'])
                pwd = f" 提取码: {nd['password']}" if nd['password'] else ""
                f.write(f"  [{type_name}] {nd['url']}{pwd}\n")
            f.write("\n")
    
    total = sum(len(m.get('netdisk_resources', [])) for m in data)
    print(f"已导出 {total} 条网盘链接到 {output_file}")
    return output_file

def download_with_ffmpeg(url, output, referer=None, user_agent=None):
    """使用ffmpeg下载单个m3u8"""
    if user_agent is None:
        user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    
    headers = f"User-Agent: {user_agent}\r\n"
    if referer:
        headers += f"Referer: {referer}\r\n"
    
    cmd = [
        'ffmpeg', '-y',
        '-headers', headers,
        '-i', url,
        '-c', 'copy',
        '-bsf:a', 'aac_adtstoasc',
        str(output)
    ]
    
    print(f"  执行: {' '.join(cmd[:4])} ... {output.name}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=7200)
    
    if result.returncode != 0:
        print(f"  ffmpeg错误: {result.stderr[-500:] if result.stderr else 'unknown'}")
        return False
    return True

def download_from_json(json_file, output_dir=None, source_index=0, max_episodes=None):
    """从单个JSON文件下载视频"""
    with open(json_file, 'r', encoding='utf-8') as f:
        detail = json.load(f)
    
    title = safe_filename(detail.get('title', 'unknown'))
    if output_dir is None:
        output_dir = Path("ddys_data/media") / title
    else:
        output_dir = Path(output_dir) / title
    output_dir.mkdir(parents=True, exist_ok=True)
    
    sources = detail.get('video_sources', [])
    if not sources:
        print("没有找到视频源")
        return
    
    if source_index >= len(sources):
        print(f"源索引 {source_index} 超出范围，共有 {len(sources)} 个源")
        return
    
    source = sources[source_index]
    print(f"下载: {detail.get('title')}")
    print(f"使用: {source['source_name']} ({source['format']})")
    
    episodes = source.get('episodes', [])
    if max_episodes:
        episodes = episodes[:max_episodes]
    
    success = 0
    for i, ep in enumerate(episodes):
        ep_name = safe_filename(ep['name'])
        output_file = output_dir / f"{ep_name}.mp4"
        
        if output_file.exists() and output_file.stat().st_size > 10240:
            print(f"  [{i+1}/{len(episodes)}] 已存在: {ep_name}")
            success += 1
            continue
        
        print(f"  [{i+1}/{len(episodes)}] 下载: {ep_name}")
        if download_with_ffmpeg(ep['url'], output_file, referer=detail.get('url')):
            success += 1
        else:
            print(f"  失败: {ep_name}")
    
    print(f"\n完成: {success}/{len(episodes)} 集")

def main():
    parser = argparse.ArgumentParser(description='ddys.io 数据工具')
    parser.add_argument('--csv', type=str, help='JSON文件导出为CSV')
    parser.add_argument('--netdisk', type=str, help='导出所有网盘链接')
    parser.add_argument('--download', type=str, help='从JSON文件下载视频')
    parser.add_argument('--source', type=int, default=0, help='播放源索引(默认0)')
    parser.add_argument('--episodes', type=int, help='最多下载集数')
    parser.add_argument('--output', type=str, help='输出目录')
    
    args = parser.parse_args()
    
    if args.csv:
        export_to_csv(args.csv, args.output)
    elif args.netdisk:
        export_netdisk_links(args.netdisk, args.output)
    elif args.download:
        download_from_json(args.download, args.output, args.source, args.episodes)
    else:
        parser.print_help()
        print("\n示例:")
        print("  python ddys_utils.py --csv ddys_data/full_data.json")
        print("  python ddys_utils.py --netdisk ddys_data/full_data.json")
        print("  python ddys_utils.py --download ddys_data/xxx.json --episodes 3")

if __name__ == "__main__":
    main()
