#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
电影天堂资源站全站抓取工具
站点: https://caiji.dyttzyapi.com/
接口类型: 苹果CMS V10 标准采集API

功能特性:
1. 自动分页抓取全量视频数据(约8.4万条)
2. 支持多线程并发采集
3. 断点续传(异常中断后可从上次位置继续)
4. 数据实时保存为JSON/CSV格式
5. 支持按分类筛选抓取
6. 自动重试与请求限速
7. 抓取进度实时展示
"""

import os
import sys
import json
import time
import csv
import threading
import queue
import argparse
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# ============ 配置项 ============
BASE_URL = "https://caiji.dyttzyapi.com/"
API_BASE = urljoin(BASE_URL, "/api.php/provide/vod/")

# 分类映射 (从API获取的分类)
CATEGORY_MAP = {
    1: "电影片", 2: "连续剧", 3: "综艺片", 4: "动漫片",
    6: "动作片", 7: "喜剧片", 8: "爱情片", 9: "科幻片",
    10: "恐怖片", 11: "剧情片", 12: "战争片", 13: "国产剧",
    14: "香港剧", 15: "韩国剧", 16: "欧美剧", 20: "记录片",
    21: "台湾剧", 22: "日本剧", 23: "海外剧", 24: "泰国剧",
    25: "大陆综艺", 26: "港台综艺", 27: "日韩综艺", 28: "欧美综艺",
    29: "国产动漫", 30: "日韩动漫", 31: "欧美动漫", 32: "港台动漫",
    33: "海外动漫", 34: "伦理片", 36: "短剧", 37: "动画片",
}

# 视频核心字段(输出到CSV时使用)
VOD_FIELDS = [
    "vod_id", "type_id", "type_name", "vod_name", "vod_sub", "vod_en",
    "vod_letter", "vod_pic", "vod_actor", "vod_director", "vod_blurb",
    "vod_remarks", "vod_pubdate", "vod_area", "vod_lang", "vod_year",
    "vod_isend", "vod_score", "vod_douban_id", "vod_douban_score",
    "vod_time", "vod_time_add", "vod_content", "vod_play_from", "vod_play_url"
]


class DYTTCrawler:
    """电影天堂资源站爬虫"""

    def __init__(self, output_dir="./output", max_workers=5, delay=0.3,
                 page_size=50, categories=None, format_type="both"):
        """
        初始化爬虫
        :param output_dir: 输出目录
        :param max_workers: 最大并发线程数
        :param delay: 每次请求间隔(秒)
        :param page_size: 每页条数(建议10-100)
        :param categories: 指定抓取分类ID列表, None表示抓取全部分类
        :param format_type: 输出格式: json/csv/both
        """
        self.output_dir = output_dir
        self.max_workers = max_workers
        self.delay = delay
        self.page_size = min(max(page_size, 10), 100)  # 限制在10-100之间
        self.categories = categories
        self.format_type = format_type

        # 统计信息
        self.total_count = 0
        self.fetched_count = 0
        self.failed_pages = []
        self.start_time = None

        # 线程安全锁
        self.lock = threading.Lock()
        self.progress_lock = threading.Lock()

        # 断点续传
        self.checkpoint_file = os.path.join(output_dir, ".checkpoint.json")
        self.completed_pages = set()

        # 数据存储
        self.data_queue = queue.Queue()
        self.all_vod_ids = set()  # 用于去重

        # 初始化Session
        self.session = self._create_session()

        # 创建输出目录
        os.makedirs(output_dir, exist_ok=True)

        # 数据写入器
        self.json_file = None
        self.csv_file = None
        self.csv_writer = None

    def _create_session(self):
        """创建带重试机制的requests session"""
        session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy, pool_connections=20, pool_maxsize=20)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Referer": BASE_URL,
        })
        return session

    def _load_checkpoint(self):
        """加载断点记录"""
        if os.path.exists(self.checkpoint_file):
            try:
                with open(self.checkpoint_file, "r", encoding="utf-8") as f:
                    checkpoint = json.load(f)
                self.completed_pages = set(checkpoint.get("completed_pages", []))
                print(f"[+] 加载断点记录: 已完成 {len(self.completed_pages)} 页")
            except Exception as e:
                print(f"[!] 断点记录加载失败: {e}")

    def _save_checkpoint(self):
        """保存断点记录"""
        with self.lock:
            try:
                with open(self.checkpoint_file, "w", encoding="utf-8") as f:
                    json.dump({
                        "completed_pages": list(self.completed_pages),
                        "fetched_count": self.fetched_count,
                        "timestamp": datetime.now().isoformat()
                    }, f, ensure_ascii=False)
            except Exception as e:
                print(f"[!] 断点保存失败: {e}")

    def _init_output_files(self):
        """初始化输出文件"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if self.format_type in ("json", "both"):
            json_path = os.path.join(self.output_dir, f"dytt_videos_{timestamp}.json")
            self.json_file = open(json_path, "w", encoding="utf-8")
            self.json_file.write("[\n")
            print(f"[+] JSON输出文件: {json_path}")

        if self.format_type in ("csv", "both"):
            csv_path = os.path.join(self.output_dir, f"dytt_videos_{timestamp}.csv")
            self.csv_file = open(csv_path, "w", encoding="utf-8-sig", newline="")
            self.csv_writer = csv.DictWriter(self.csv_file, fieldnames=VOD_FIELDS, extrasaction="ignore")
            self.csv_writer.writeheader()
            print(f"[+] CSV输出文件: {csv_path}")

    def _close_output_files(self):
        """关闭输出文件"""
        if self.json_file:
            self.json_file.write("\n]")
            self.json_file.close()
        if self.csv_file:
            self.csv_file.close()

    def _fetch_page(self, page):
        """
        抓取单页数据
        :param page: 页码
        :return: (是否成功, 页码, 视频列表, 总页数)
        """
        if page in self.completed_pages:
            return True, page, [], 0

        params = {
            "ac": "videolist",
            "pg": page,
            "pagesize": self.page_size,
        }

        # 如果指定了分类
        if self.categories and len(self.categories) == 1:
            params["t"] = self.categories[0]

        try:
            time.sleep(self.delay)
            resp = self.session.get(API_BASE, params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()

            if data.get("code") != 1:
                print(f"[!] 第{page}页API返回错误: {data.get('msg')}")
                return False, page, [], 0

            video_list = data.get("list", [])
            pagecount = data.get("pagecount", 1)
            total = data.get("total", 0)

            # 获取详情(带播放地址) - 批量获取
            if video_list:
                ids = ",".join([str(v["vod_id"]) for v in video_list])
                detail_params = {
                    "ac": "detail",
                    "ids": ids,
                }
                time.sleep(self.delay * 0.5)
                detail_resp = self.session.get(API_BASE, params=detail_params, timeout=30)
                if detail_resp.status_code == 200:
                    detail_data = detail_resp.json()
                    if detail_data.get("code") == 1:
                        video_list = detail_data.get("list", video_list)

            return True, page, video_list, pagecount, total

        except Exception as e:
            print(f"[!] 第{page}页抓取失败: {e}")
            return False, page, [], 0

    def _save_videos(self, videos):
        """保存视频数据到文件"""
        with self.lock:
            for video in videos:
                vod_id = video.get("vod_id")
                if vod_id in self.all_vod_ids:
                    continue
                self.all_vod_ids.add(vod_id)

                # 写入JSON
                if self.json_file:
                    prefix = "" if len(self.all_vod_ids) == 1 else ",\n"
                    self.json_file.write(prefix + json.dumps(video, ensure_ascii=False))

                # 写入CSV
                if self.csv_writer:
                    self.csv_writer.writerow({k: video.get(k, "") for k in VOD_FIELDS})

            self.fetched_count += len(videos)

    def _print_progress(self, page, total_pages):
        """打印进度"""
        with self.progress_lock:
            elapsed = time.time() - self.start_time
            speed = self.fetched_count / elapsed if elapsed > 0 else 0
            progress = (page / total_pages * 100) if total_pages > 0 else 0
            eta = (total_pages - page) * self.page_size / speed / 60 if speed > 0 else 0

            sys.stdout.write(
                f"\r[*] 进度: {page}/{total_pages} 页 ({progress:.1f}%) | "
                f"已抓取: {self.fetched_count}/{self.total_count} 条 | "
                f"速度: {speed:.0f} 条/秒 | 预计剩余: {eta:.1f} 分钟"
            )
            sys.stdout.flush()

    def fetch_categories(self):
        """获取所有分类信息"""
        print("[*] 正在获取分类列表...")
        try:
            resp = self.session.get(API_BASE, params={"ac": "list"}, timeout=15)
            data = resp.json()
            if data.get("class"):
                print("[+] 可用分类:")
                for cls in data["class"]:
                    print(f"    {cls['type_id']}: {cls['type_name']}")
                return data["class"]
        except Exception as e:
            print(f"[!] 获取分类失败: {e}")
        return []

    def _worker(self, page_queue, total_pages):
        """工作线程"""
        while True:
            try:
                page = page_queue.get_nowait()
            except queue.Empty:
                break

            success, page, videos, pagecount, total = self._fetch_page(page)

            if success and videos:
                self._save_videos(videos)
                with self.lock:
                    self.completed_pages.add(page)
                # 每10页保存一次断点
                if page % 10 == 0:
                    self._save_checkpoint()
            elif not success:
                with self.lock:
                    self.failed_pages.append(page)

            with self.lock:
                if total > self.total_count:
                    self.total_count = total
                if pagecount > total_pages[0]:
                    total_pages[0] = pagecount

            self._print_progress(page, total_pages[0])
            page_queue.task_done()

    def run(self):
        """启动全站抓取"""
        print("=" * 60)
        print("电影天堂资源站全站爬虫")
        print(f"目标站点: {BASE_URL}")
        print(f"并发线程: {self.max_workers}")
        print(f"请求间隔: {self.delay}秒")
        print("=" * 60)

        self.start_time = time.time()

        # 加载断点
        self._load_checkpoint()

        # 初始化输出文件
        self._init_output_files()

        # 先获取第一页确定总页数
        print("[*] 正在获取站点数据概览...")
        success, _, first_page_videos, total_pages, total_count = self._fetch_page(1)
        if not success:
            print("[!] 无法连接到API接口，请检查网络或站点可用性")
            return

        self.total_count = total_count
        print(f"[+] 站点总资源数: {self.total_count} 条")
        print(f"[+] 总页数: {total_pages} 页")

        # 保存第一页数据
        if first_page_videos:
            self._save_videos(first_page_videos)
            self.completed_pages.add(1)

        # 构建页码队列
        page_queue = queue.Queue()
        for pg in range(2, total_pages + 1):
            if pg not in self.completed_pages:
                page_queue.put(pg)

        print(f"[+] 待抓取页数: {page_queue.qsize()} 页")
        print("[*] 开始抓取...\n")

        # 启动多线程
        total_pages_ref = [total_pages]
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [
                executor.submit(self._worker, page_queue, total_pages_ref)
                for _ in range(self.max_workers)
            ]
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    print(f"\n[!] 线程异常: {e}")

        # 重试失败页
        if self.failed_pages:
            print(f"\n[*] 正在重试 {len(self.failed_pages)} 个失败页...")
            retry_pages = self.failed_pages.copy()
            self.failed_pages.clear()
            for page in retry_pages:
                success, page, videos, _, _ = self._fetch_page(page)
                if success and videos:
                    self._save_videos(videos)
                    self.completed_pages.add(page)
                else:
                    self.failed_pages.append(page)

        # 收尾
        self._save_checkpoint()
        self._close_output_files()

        elapsed = time.time() - self.start_time
        print("\n" + "=" * 60)
        print("抓取完成!")
        print(f"总耗时: {elapsed/60:.2f} 分钟")
        print(f"成功抓取: {self.fetched_count} 条视频数据")
        if self.failed_pages:
            print(f"失败页数: {len(self.failed_pages)} 页: {self.failed_pages[:10]}...")
        print(f"输出目录: {os.path.abspath(self.output_dir)}")
        print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="电影天堂资源站全站爬虫")
    parser.add_argument("-o", "--output", default="./output", help="输出目录")
    parser.add_argument("-w", "--workers", type=int, default=5, help="并发线程数(默认5)")
    parser.add_argument("-d", "--delay", type=float, default=0.3, help="请求间隔秒(默认0.3)")
    parser.add_argument("-p", "--pagesize", type=int, default=50, help="每页条数(默认50,最大100)")
    parser.add_argument("-t", "--type", type=str, default=None, help="指定分类ID(多个用逗号分隔)")
    parser.add_argument("-f", "--format", type=str, default="both", choices=["json", "csv", "both"],
                        help="输出格式(默认both)")
    parser.add_argument("--list-types", action="store_true", help="列出所有分类后退出")

    args = parser.parse_args()

    crawler = DYTTCrawler(
        output_dir=args.output,
        max_workers=args.workers,
        delay=args.delay,
        page_size=args.pagesize,
        categories=[int(x) for x in args.type.split(",")] if args.type else None,
        format_type=args.format,
    )

    if args.list_types:
        crawler.fetch_categories()
        return

    crawler.run()


if __name__ == "__main__":
    main()
