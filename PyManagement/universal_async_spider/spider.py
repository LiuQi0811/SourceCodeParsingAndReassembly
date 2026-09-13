"""
主爬虫类 —— UniversalSpider
设计模式说明：
  - 工厂模式：Downloader / DecryptorFactory
  - 策略模式：多种 Decryptor 策略可替换
  - 单例模式：Logger 单例、Config 单例使用
  - 观察者模式：Progress 组件订阅下载结果
"""
import asyncio
import aiofiles
from collections import deque
from pathlib import Path
from typing import Optional

from .config import Config
from .downloader import Downloader
from .parser import Parser
from .decryptor import DecryptorFactory
from .state import StateManager
from .progress import Progress
from .utils import (
    setup_logger, normalize_url, url_to_filename, extract_domain, is_resource_url
)


class UniversalSpider:
    """通用异步全站爬虫"""

    def __init__(self, config: Config):
        self.config = config
        self.config.ensure_output_dir()

        self.logger = setup_logger(
            "spider", level=self.config.log_level, log_file=self.config.log_file
        )

        self.downloader = Downloader(config)
        self.parser = Parser(config)
        self.state = StateManager(config.state_file)
        self.progress = Progress()

        # 待爬队列：(url, depth)
        self.queue: deque = deque()
        # 正在处理的任务计数
        self._in_progress = 0
        self._lock = asyncio.Lock()
        self._save_counter = 0

    # ==================== 启动入口 ====================
    def run(self):
        """同步入口"""
        asyncio.run(self.crawl())

    async def crawl(self):
        self.logger.info("=" * 60)
        self.logger.info("Universal Async Spider 启动")
        self.logger.info(f"起始 URL: {self.config.start_urls}")
        self.logger.info(f"允许域名: {self.config.allowed_domains}")
        self.logger.info(f"输出目录: {self.config.output_dir}")
        self.logger.info("=" * 60)

        # 断点续传
        resumed = False
        if self.config.resume:
            resumed = self.state.load()
            if resumed:
                self.logger.info(
                    f"检测到断点状态：已完成 {len(self.state.visited)}，"
                    f"失败 {len(self.state.failed)}，待爬 {len(self.state.queued)}"
                )

        if resumed and self.state.queued:
            # 恢复队列
            for u in self.state.queued:
                self.queue.append((u, 0))
            self.state.queued.clear()
        else:
            # 从 start_urls 初始化
            for url in self.config.start_urls:
                url = normalize_url(url)
                if not self.config.allowed_domains:
                    self.config.allowed_domains.add(extract_domain(url))
                self.queue.append((url, 0))

        if not self.config.allowed_domains:
            for url in self.config.start_urls:
                self.config.allowed_domains.add(extract_domain(url))

        self.progress.start(initial_total=len(self.queue))

        try:
            await self._event_loop()
        except KeyboardInterrupt:
            self.logger.warning("收到中断信号，正在保存状态...")
        finally:
            await self._shutdown()

        self.logger.info(
            f"抓取结束。成功 {self.progress.total_success} 页，"
            f"失败 {self.progress.total_failed} 页，"
            f"总大小 {self.progress.total_bytes/(1024*1024):.2f} MB"
        )
        if self.state.failed:
            fail_log = Path(self.config.output_dir) / "failed_urls.txt"
            with open(fail_log, "w", encoding="utf-8") as f:
                f.write("\n".join(self.state.failed))
            self.logger.info(f"失败 URL 列表已保存到 {fail_log}")

    # ==================== 事件循环 ====================
    async def _event_loop(self):
        workers = []
        max_workers = self.config.concurrency
        idle_count = 0

        while True:
            # 动态启停 worker
            while len(workers) < max_workers and self.queue:
                url, depth = self.queue.popleft()
                if url in self.state.visited:
                    continue
                self.state.visited.add(url)
                task = asyncio.create_task(self._process_url(url, depth))
                workers.append(task)
                self._in_progress += 1

            if not workers:
                if not self.queue:
                    idle_count += 1
                    if idle_count >= 3:
                        break
                    await asyncio.sleep(0.2)
                    continue
                else:
                    idle_count = 0

            # 等待任意一个 worker 完成
            done, workers = await asyncio.wait(
                workers, return_when=asyncio.FIRST_COMPLETED
            )
            workers = list(workers)
            self._in_progress -= len(done)
            for d in done:
                try:
                    await d
                except Exception as e:
                    self.logger.error(f"worker 异常: {e}")

            # 定期保存状态
            self._save_counter += 1
            if self._save_counter % 10 == 0:
                self.state.save()
                self.progress.update_total(
                    len(self.state.visited) + len(self.queue)
                )

    # ==================== 单个 URL 处理 ====================
    async def _process_url(self, url: str, depth: int):
        content, status, headers = await self.downloader.fetch(url)

        if content is None or status == 0:
            self.state.failed.add(url)
            self.progress.fail(url)
            return

        # 解密处理
        if self.config.decryption == "none":
            decryptor = DecryptorFactory.get("noop")
        elif self.config.decryption == "aes":
            decryptor = DecryptorFactory.get("aes")
        else:
            decryptor = DecryptorFactory.auto_detect(content, headers, url)

        if decryptor.name != "noop":
            self.logger.debug(f"[{decryptor.name}] 解密: {url}")
        content = decryptor.decrypt(
            content,
            key=self.config.decryption_key,
            iv=self.config.decryption_iv,
        )

        # 保存到本地
        if self.config.save_html:
            await self._save_content(url, content)

        # 提取新链接
        if depth < self.config.max_depth:
            new_links = self.parser.extract_links(content, url)
            async with self._lock:
                added = 0
                for new_url, text in new_links:
                    if new_url not in self.state.visited and new_url not in self.state.queued:
                        self.queue.append((new_url, depth + 1))
                        self.state.queued.add(new_url)
                        added += 1
                if added:
                    self.progress.update_total(
                        len(self.state.visited) + len(self.queue) + self._in_progress
                    )

        # 从 queued 集合中移除（已完成）
        self.state.queued.discard(url)
        title = self.parser.clean_html(content) or url
        self.progress.success(title[:50] or url, len(content))

    # ==================== 文件保存 ====================
    async def _save_content(self, url: str, content: bytes):
        fp = url_to_filename(url, self.config.output_dir)
        try:
            fp.parent.mkdir(parents=True, exist_ok=True)
            async with aiofiles.open(fp, "wb") as f:
                await f.write(content)
        except Exception as e:
            self.logger.error(f"保存失败 {fp}: {e}")

    # ==================== 关闭清理 ====================
    async def _shutdown(self):
        await self.downloader.close()
        self.state.save()
        self.progress.close()
