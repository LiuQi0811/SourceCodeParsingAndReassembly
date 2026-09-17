#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
6vdy 爬虫 + 视频下载 一体化入口

两种运行模式：
  --mode after   全部采集完成后再统一下载（默认，适合先验证数据质量）
  --mode stream  边采集边下载（采集到一部就立即丢进下载线程池，节省总耗时）

用法：
  python3 crawl_and_download.py                                # 默认 after 模式：每分类前1页，每部最多下1个
  python3 crawl_and_download.py --mode stream                 # 边采集边下载
  python3 crawl_and_download.py --mode stream --pages 2 --max-dl 2
  python3 crawl_and_download.py --categories 喜剧片,动作片 --mode stream
  python3 crawl_and_download.py --no-download                 # 只抓取不下载
  python3 crawl_and_download.py --download-only               # 只下载已抓取的 movies.json（不重新爬）
"""

import os
import sys
import json
import time
import argparse
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import spider_6vdy as spider
import downloader

# ============ 日志 ============
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("main")


# ============ 采集 ============
def crawl(categories=None, pages=1, output_dir=None, on_item=None):
    """
    抓取资源信息
    categories: 要抓取的分类名称列表，None 表示全部
    pages: 每个分类抓前几页
    on_item: 可选回调函数 on_item(movie_data)，每抓到一部影片详情即调用（用于边采集边下载）
    返回 results 列表
    """
    if output_dir:
        spider.OUTPUT_DIR = output_dir
        spider.HTML_DIR = os.path.join(output_dir, "html")
        os.makedirs(spider.HTML_DIR, exist_ok=True)

    # 筛选分类
    cat_list = spider.CATEGORIES
    if categories:
        cat_set = set(categories)
        cat_list = [(p, n) for p, n in cat_list if n in cat_set]
        if not cat_list:
            log.error(f"未找到匹配的分类，可用分类: {[n for _, n in spider.CATEGORIES]}")
            sys.exit(1)

    results = []
    seen = set()

    for cat_path, cat_name in cat_list:
        log.info(f"=== [{cat_name}] 开始抓取前 {pages} 页 ===")
        cat_links = []
        for page in range(1, pages + 1):
            links = spider.parse_list_page(cat_path, page)
            cat_links.extend(links)
            log.info(f"  第{page}页: {len(links)} 条链接")
            time.sleep(0.3)

        # 去重
        cat_links = list(dict.fromkeys(cat_links))
        log.info(f"  [{cat_name}] 去重后共 {len(cat_links)} 个详情页")

        # 抓取详情
        done = 0
        for url in cat_links:
            if url in seen:
                continue
            try:
                data = spider.parse_detail(url, cat_name)
                if data:
                    results.append(data)
                    seen.add(url)
                    done += 1
                    link_count = (len(data["magnets"]) + len(data["thunders"]) +
                                  len(data["ed2ks"]) + len(data["ftps"]) + len(data["netdisks"]))
                    log.info(f"  [{done}/{len(cat_links)}] {data['title']} -> {link_count} 条链接")
                    # 边采集边下载：立即触发回调
                    if on_item:
                        on_item(data)
            except Exception as e:
                log.error(f"  抓取异常 {url}: {e}")

        # 每个分类抓完保存一次
        spider.save_results(results)
        spider.save_seen(seen)
        log.info(f"[{cat_name}] 完成，累计 {len(results)} 部")

    # 最终保存
    spider.save_results(results)
    spider.save_seen(seen)
    log.info(f"抓取完成！共 {len(results)} 部影片，已保存到 {spider.OUTPUT_DIR}")
    return results


# ============ 批量下载（全部采集后再下载）============
def download(results, download_dir, max_per_movie=1):
    """
    批量下载影片资源（串行遍历，全部采集完成后调用）
    """
    os.makedirs(download_dir, exist_ok=True)
    report_path = os.path.join(download_dir, "download_report.json")

    # 加载已有下载报告（断点续下）
    report = []
    downloaded_titles = set()
    if os.path.exists(report_path):
        try:
            with open(report_path, "r", encoding="utf-8") as f:
                report = json.load(f)
            downloaded_titles = {r["title"] for r in report if r.get("downloaded")}
            log.info(f"已加载下载报告，{len(downloaded_titles)} 部已有下载记录")
        except Exception:
            pass

    total = len(results)
    for idx, movie in enumerate(results, 1):
        title = movie.get("title", "unknown")
        if title in downloaded_titles:
            log.info(f"[{idx}/{total}] 跳过（已下载）: {title}")
            continue

        log.info(f"[{idx}/{total}] 开始处理: {title}")
        result = downloader.download_movie(movie, download_dir, max_per_movie)
        report.append(result)

        # 每部处理完保存报告
        downloader.save_download_report(report, report_path)

        # 统计
        dl = len(result["downloaded"])
        sk = len(result["skipped"])
        fl = len(result["failed"])
        log.info(f"  -> 完成: 下载{dl} 跳过{sk} 失败{fl}")

    _print_download_summary(report, download_dir, report_path)
    return report


# ============ 流式下载（边采集边下载）============
class StreamDownloader:
    """
    边采集边下载管理器
    - 内部维护下载线程池，采集线程调用 submit() 后立即返回，不阻塞采集
    - 下载报告线程安全更新，每完成一部就持久化
    - 支持断点续下（已下载的标题自动跳过）
    """

    def __init__(self, download_dir, max_per_movie=1, max_workers=2):
        self.download_dir = download_dir
        self.max_per_movie = max_per_movie
        self.report_path = os.path.join(download_dir, "download_report.json")
        os.makedirs(download_dir, exist_ok=True)

        self._lock = threading.Lock()
        self._report = []
        self._downloaded_titles = set()
        self._submitted_titles = set()  # 已提交到线程池的（避免重复提交）
        self._completed = 0
        self._total_submitted = 0

        # 加载已有下载报告
        if os.path.exists(self.report_path):
            try:
                with open(self.report_path, "r", encoding="utf-8") as f:
                    self._report = json.load(f)
                self._downloaded_titles = {r["title"] for r in self._report if r.get("downloaded")}
                log.info(f"[流式下载] 已加载下载报告，{len(self._downloaded_titles)} 部已有下载记录")
            except Exception:
                pass

        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="downloader")
        self._futures = {}
        log.info(f"[流式下载] 已启动，下载线程数={max_workers}，每部最多下载={max_per_movie}")

    def submit(self, movie_data):
        """提交一部影片到下载线程池（非阻塞）"""
        title = movie_data.get("title", "unknown")

        with self._lock:
            if title in self._downloaded_titles:
                log.info(f"[流式下载] 跳过（已下载）: {title}")
                return
            if title in self._submitted_titles:
                log.info(f"[流式下载] 跳过（已在下载队列）: {title}")
                return
            self._submitted_titles.add(title)
            self._total_submitted += 1

        future = self._executor.submit(self._download_one, movie_data)
        self._futures[future] = title
        log.info(f"[流式下载] 已提交: {title}（队列中 {self._total_submitted - self._completed} 部）")

    def _download_one(self, movie_data):
        """单个影片下载（在线程池中执行）"""
        title = movie_data.get("title", "unknown")
        try:
            result = downloader.download_movie(movie_data, self.download_dir, self.max_per_movie)
        except Exception as e:
            log.error(f"[流式下载] 下载异常 {title}: {e}")
            result = {
                "title": title,
                "category": movie_data.get("category", ""),
                "save_dir": "",
                "downloaded": [],
                "skipped": [],
                "failed": [{"type": "error", "url": "", "text": "", "reason": str(e)[:200]}],
            }

        with self._lock:
            self._report.append(result)
            if result.get("downloaded"):
                self._downloaded_titles.add(title)
            self._completed += 1
            # 每完成一部就保存报告
            downloader.save_download_report(self._report, self.report_path)

        dl = len(result["downloaded"])
        sk = len(result["skipped"])
        fl = len(result["failed"])
        log.info(f"[流式下载] 完成 [{self._completed}/{self._total_submitted}] {title} -> 下载{dl} 跳过{sk} 失败{fl}")
        return result

    def wait(self):
        """等待所有下载任务完成，并输出最终统计"""
        log.info(f"[流式下载] 采集结束，等待 {len(self._futures)} 个下载任务完成...")
        for future in as_completed(self._futures):
            try:
                future.result()
            except Exception as e:
                log.error(f"[流式下载] 任务异常: {e}")
        self._executor.shutdown(wait=True)
        _print_download_summary(self._report, self.download_dir, self.report_path)
        return self._report


def _print_download_summary(report, download_dir, report_path):
    """统一的下载统计输出"""
    total_dl = sum(len(r["downloaded"]) for r in report)
    total_skip = sum(len(r["skipped"]) for r in report)
    total_fail = sum(len(r["failed"]) for r in report)
    log.info("=" * 50)
    log.info(f"下载处理完成！共处理 {len(report)} 部影片")
    log.info(f"  成功下载: {total_dl} 个文件")
    log.info(f"  跳过(网盘/ED2K): {total_skip} 个链接")
    log.info(f"  下载失败: {total_fail} 个链接")
    log.info(f"  下载目录: {download_dir}")
    log.info(f"  报告文件: {report_path}")


# ============ 主入口 ============
def main():
    parser = argparse.ArgumentParser(description="6vdy 爬虫 + 视频下载")
    parser.add_argument("--mode", type=str, default="after", choices=["after", "stream"],
                        help="运行模式：after=全部采集后再下载（默认），stream=边采集边下载")
    parser.add_argument("--categories", type=str, default=None,
                        help="指定分类，逗号分隔，如: 喜剧片,动作片,剧情片")
    parser.add_argument("--pages", type=int, default=1,
                        help="每个分类抓取前几页（默认1）")
    parser.add_argument("--max-dl", type=int, default=1,
                        help="每部影片最多下载几个链接（默认1）")
    parser.add_argument("--download-workers", type=int, default=2,
                        help="流式下载模式下的并发下载线程数（默认2，磁力下载不建议太大）")
    parser.add_argument("--no-download", action="store_true",
                        help="只抓取资源信息，不下载视频")
    parser.add_argument("--download-only", action="store_true",
                        help="只下载已抓取的 movies.json，不重新爬取（强制 after 模式）")
    parser.add_argument("--output", type=str, default=None,
                        help="输出目录（默认项目下 output/）")
    args = parser.parse_args()

    output_dir = args.output or os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    download_dir = os.path.join(output_dir, "videos")
    os.makedirs(output_dir, exist_ok=True)

    log.info(f"运行模式: {'边采集边下载(stream)' if args.mode == 'stream' else '全部采集后再下载(after)'}")
    log.info(f"输出目录: {output_dir}")
    log.info(f"下载目录: {download_dir}")
    log.info(f"aria2c: {downloader.ARIA2C or '未安装（磁力将无法下载）'}")
    log.info(f"curl:   {downloader.CURL or '未安装'}")

    # --download-only 强制走 after 模式（从已有 JSON 批量下载）
    if args.download_only:
        movies_json = os.path.join(output_dir, "movies.json")
        if not os.path.exists(movies_json):
            log.error(f"未找到 {movies_json}，请先运行抓取")
            sys.exit(1)
        with open(movies_json, "r", encoding="utf-8") as f:
            results = json.load(f)
        log.info(f"从 {movies_json} 加载 {len(results)} 部影片")
        if not args.no_download and results:
            log.info(f"\n{'='*50}")
            log.info(f"开始批量下载 {len(results)} 部影片（每部最多 {args.max_dl} 个）")
            download(results, download_dir, max_per_movie=args.max_dl)
        return

    # 根据模式选择执行路径
    if args.mode == "stream" and not args.no_download:
        # ===== 边采集边下载 =====
        stream_dl = StreamDownloader(
            download_dir=download_dir,
            max_per_movie=args.max_dl,
            max_workers=args.download_workers,
        )
        categories = args.categories.split(",") if args.categories else None
        results = crawl(
            categories=categories,
            pages=args.pages,
            output_dir=output_dir,
            on_item=stream_dl.submit,  # 关键：每抓到一部就提交下载
        )
        # 采集结束后等待所有下载完成
        stream_dl.wait()

    else:
        # ===== 全部采集后再下载（默认）=====
        categories = args.categories.split(",") if args.categories else None
        results = crawl(categories=categories, pages=args.pages, output_dir=output_dir)

        if not args.no_download and results:
            log.info(f"\n{'='*50}")
            log.info(f"开始批量下载 {len(results)} 部影片（每部最多 {args.max_dl} 个）")
            download(results, download_dir, max_per_movie=args.max_dl)
        elif args.no_download:
            log.info("已指定 --no-download，跳过视频下载")


if __name__ == "__main__":
    main()
