"""
通用全站爬虫模板 V5
新增：
1. 重试队列独立协程调度 + 独立延时，不抢占普通任务并发
2. 任务超时隔离，下载任务带超时保护
3. 代理池自动轮询、故障剔除
4. Prometheus metrics http导出
5. 令牌桶全局RPS限速
"""
import asyncio
import json
import os
import re
import hashlib
import time
import math
from dataclasses import dataclass, asdict, field
from typing import List, Callable, Optional, Dict, Any, Deque
from collections import deque
from urllib.parse import urljoin, urlparse, unquote, parse_qs, urlencode
import requests
from lxml import etree
from playwright.async_api import async_playwright, Page
import sqlite3

# prometheus 指标
try:
    from prometheus_client import Counter, Gauge, Summary, generate_latest
    from prometheus_client.core import REGISTRY
    from aiohttp import web
except ImportError:
    web = None
    REGISTRY = None
    Counter = Gauge = Summary = None

try:
    import aiomysql
except ImportError:
    aiomysql = None

# ===================== 数据模型 V5 =====================
@dataclass
class CrawlTask:
    url: str
    depth: int
    referer: str = ""
    tags: List[str] = field(default_factory=list)
    extra: Dict[str, Any] = field(default_factory=dict)

    # http 请求
    method: str = "GET"
    post_body: Optional[Dict[str, Any]] = None   # post json
    form_data: Optional[Dict[str, Any]] = None   # post form‑data/x‑www‑form‑urlencoded

    # 优先级：数字越小优先级越高，0最高，1普通，2低
    priority: int = 1
    # 失败重试
    retry_count: int = 0

@dataclass
class CrawlResultItem:
    url: str
    title: str = ""
    publish_time: str = ""
    content: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    out_links: List[str] = field(default_factory=list)

@dataclass
class CrawlerConfig:
    max_depth: int = 3
    max_task_count: int = 1000
    concurrency: int = 4
    default_delay_sec: float = 1.0
    domain_delay_map: Dict[str, float] = field(default_factory=dict)

    output_file: str = "crawl_out.jsonl"
    fail_file: str = "crawl_fail.txt"
    resume_file: str = "crawl_resume.json"

    domain_whitelist: List[str] = field(default_factory=list)
    domain_blacklist: List[str] = field(default_factory=list)
    enable_resume: bool = True

    dedup_sqlite_path: str = "crawl_dedup.db"
    mysql_conf: Dict[str, Any] = field(default_factory=dict)

    # 失败重试配置
    max_retry: int = 2
    retry_backoff_base: float = 2.0

    # 去重白名单：该列表内url跳过指纹校验强制爬取
    dedup_whitelist: List[str] = field(default_factory=list)

    # 监控指标输出间隔(秒)
    monitor_interval: int = 10

    # ========== V5新增配置 ==========
    # 任务超时隔离
    task_timeout: int = 30

    # 代理池
    proxy_pool: List[str] = field(default_factory=list)
    proxy_health_check: bool = True

    # prometheus
    prometheus_enable: bool = False
    prometheus_host: str = "0.0.0.0"
    prometheus_port: int = 8000

    # 令牌桶全局限速
    token_bucket_rps: float = 0.0  # 0代表关闭；例如2.0代表全局最大2请求每秒
    token_bucket_capacity: float = 5.0

# ===================== 令牌桶限速实现 =====================
class TokenBucket:
    def __init__(self, rps: float, capacity: float):
        self.rps = rps
        self.capacity = capacity
        self.tokens = capacity
        self.last_refill = time.time()
        self._lock = asyncio.Lock()

    async def consume(self):
        if self.rps <= 0:
            return
        async with self._lock:
            now = time.time()
            delta = now - self.last_refill
            add = delta * self.rps
            self.tokens = min(self.capacity, self.tokens + add)
            self.last_refill = now
            if self.tokens >= 1.0:
                self.tokens -= 1.0
                return
            need = 1.0 - self.tokens
            sleep_time = need / self.rps
        await asyncio.sleep(sleep_time)
        async with self._lock:
            self.tokens -= 1.0
            self.last_refill = time.time()

# ===================== 代理池自动轮换 =====================
class ProxyPool:
    def __init__(self, proxy_list: List[str], health_check: bool = True):
        self.proxy_list = proxy_list.copy()
        self.health_check = health_check
        self.bad_proxies: set = set()
        self.index = 0
        self._lock = asyncio.Lock()

    async def get_proxy(self) -> Optional[str]:
        if not self.proxy_list:
            return None
        async with self._lock:
            usable = [p for p in self.proxy_list if p not in self.bad_proxies]
            if not usable:
                # 全部失效，恢复全部
                self.bad_proxies.clear()
                usable = self.proxy_list.copy()
            p = usable[self.index % len(usable)]
            self.index += 1
            return p

    async def mark_bad(self, proxy: str):
        async with self._lock:
            self.bad_proxies.add(proxy)

# ===================== URL工具集 =====================
def normalize_url(url: str) -> str:
    if not url:
        return ""
    u = unquote(url.strip())
    parsed = urlparse(u)
    return parsed._replace(fragment="").geturl()


def gen_url_fingerprint(url: str, ignore_query_keys: List[str] = None) -> str:
    if ignore_query_keys is None:
        ignore_query_keys = ["utm_source", "utm_medium", "utm_campaign", "_t", "random", "timestamp"]
    parsed = urlparse(normalize_url(url))
    qs = parse_qs(parsed.query, keep_blank_values=False)
    clean_qs = {}
    for k, v in qs.items():
        if k.lower() not in set(x.lower() for x in ignore_query_keys):
            clean_qs[k] = v
    new_query = urlencode(clean_qs, doseq=True)
    clean_url = parsed._replace(query=new_query, fragment="").geturl()
    fp = hashlib.md5(clean_url.encode("utf‑8")).hexdigest()
    return fp


def get_netloc(url: str) -> str:
    try:
        return urlparse(url).netloc.lower()
    except Exception:
        return ""


def get_root_host(url: str) -> str:
    netloc = get_netloc(url)
    return netloc.replace("www.", "")


def is_allow_domain(url: str, whitelist: List[str], blacklist: List[str]) -> bool:
    if not url:
        return False
    netloc = get_netloc(url)
    if not netloc:
        return False
    host = netloc.replace("www.", "")
    for b in blacklist:
        if b in host:
            return False
    if not whitelist:
        return True
    for w in whitelist:
        w = w.lower().replace("www.", "")
        if w in host:
            return True
    return False


def extract_abs_links(base_url: str, href_list: List[str]) -> List[str]:
    out = []
    for href in href_list:
        href = str(href).strip()
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        abs_u = urljoin(base_url, href)
        norm_u = normalize_url(abs_u)
        out.append(norm_u)
    return out

# ===================== Parser基类，内置分页工具 =====================
class BaseSiteParser:
    def get_next_page(self, html: str, base_url: str) -> Optional[str]:
        doc = etree.HTML(html)
        next_text_patterns = ["下一页", "下页", "Next", "next", "»", ">"]
        a_nodes = doc.xpath("//a")
        for a in a_nodes:
            text = (a.text or "").strip()
            href = a.get("href")
            if not href:
                continue
            if any(pat in text for pat in next_text_patterns):
                abs_link = extract_abs_links(base_url, [href])
                if abs_link:
                    return abs_link[0]
        return None

    def parse(self, html: str, task: CrawlTask) -> CrawlResultItem:
        raise NotImplementedError("子类实现parse方法")

# ===================== Storage 存储适配器 =====================
class BaseStorage:
    async def init(self):
        pass

    async def save_item(self, item: CrawlResultItem):
        raise NotImplementedError

    async def save_fail(self, task: CrawlTask, err_msg: str):
        raise NotImplementedError

    async def check_seen(self, url: str, dedup_whitelist: List[str]) -> bool:
        if url in dedup_whitelist:
            return False
        raise NotImplementedError

    async def mark_seen(self, url: str):
        raise NotImplementedError

    async def close(self):
        pass


class JsonlStorage(BaseStorage):
    def __init__(self, cfg: CrawlerConfig):
        self.cfg = cfg

    async def init(self):
        pass

    async def save_item(self, item: CrawlResultItem):
        with open(self.cfg.output_file, "a", encoding="utf‑8") as f:
            f.write(json.dumps(asdict(item), ensure_ascii=False) + "\n")

    async def save_fail(self, task: CrawlTask, err_msg: str):
        line = f"{task.url}\t{task.depth}\t{err_msg}\n"
        with open(self.cfg.fail_file, "a", encoding="utf‑8") as f:
            f.write(line)

    async def check_seen(self, url: str, dedup_whitelist: List[str]) -> bool:
        if url in dedup_whitelist:
            return False
        return False

    async def mark_seen(self, url: str):
        pass

    async def close(self):
        pass


class SqliteStorage(BaseStorage):
    def __init__(self, cfg: CrawlerConfig):
        self.cfg = cfg
        self.db_path = cfg.dedup_sqlite_path
        self.conn: Optional[sqlite3.Connection] = None

    async def init(self):
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        cur = self.conn.cursor()
        cur.execute("""
        CREATE TABLE IF NOT EXISTS crawl_result(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT UNIQUE,
            title TEXT,
            publish_time TEXT,
            content TEXT,
            metadata TEXT,
            create_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS crawl_fail(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT,
            depth INTEGER,
            error TEXT,
            create_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        cur.execute("""
        CREATE TABLE IF NOT EXISTS url_fingerprint(
            fp TEXT PRIMARY KEY,
            url TEXT,
            create_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        self.conn.commit()

    def _is_fp_exists(self, fp: str) -> bool:
        cur = self.conn.cursor()
        cur.execute("SELECT 1 FROM url_fingerprint WHERE fp=?", (fp,))
        row = cur.fetchone()
        return row is not None

    def _insert_fp(self, fp: str, url: str):
        cur = self.conn.cursor()
        cur.execute("INSERT OR IGNORE INTO url_fingerprint(fp,url) VALUES (?,?)", (fp, url))
        self.conn.commit()

    async def save_item(self, item: CrawlResultItem):
        cur = self.conn.cursor()
        cur.execute("""
        INSERT OR IGNORE INTO crawl_result(url,title,publish_time,content,metadata)
        VALUES (?,?,?,?,?)
        """, (
            item.url,
            item.title,
            item.publish_time,
            item.content,
            json.dumps(item.metadata, ensure_ascii=False)
        ))
        self.conn.commit()

    async def save_fail(self, task: CrawlTask, err_msg: str):
        cur = self.conn.cursor()
        cur.execute("INSERT INTO crawl_fail(url,depth,error) VALUES (?,?,?)",
                    (task.url, task.depth, err_msg))
        self.conn.commit()

    async def check_seen(self, url: str, dedup_whitelist: List[str]) -> bool:
        if url in dedup_whitelist:
            return False
        fp = gen_url_fingerprint(url)
        return self._is_fp_exists(fp)

    async def mark_seen(self, url: str):
        fp = gen_url_fingerprint(url)
        self._insert_fp(fp, url)

    async def close(self):
        if self.conn:
            self.conn.close()


class MysqlStorage(BaseStorage):
    def __init__(self, cfg: CrawlerConfig):
        self.cfg = cfg
        self.mysql_conf = cfg.mysql_conf
        self.pool = None

    async def init(self):
        if aiomysql is None:
            raise RuntimeError("需要安装aiomysql: pip install aiomysql")
        self.pool = await aiomysql.create_pool(**self.mysql_conf)
        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                CREATE TABLE IF NOT EXISTS crawl_result(
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    url VARCHAR(2048),
                    title VARCHAR(1024),
                    publish_time VARCHAR(256),
                    content TEXT,
                    metadata JSON,
                    create_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """)
                await cur.execute("""
                CREATE TABLE IF NOT EXISTS crawl_fail(
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    url VARCHAR(2048),
                    depth INT,
                    error TEXT,
                    create_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """)
                await cur.execute("""
                CREATE TABLE IF NOT EXISTS url_fingerprint(
                    fp CHAR(32) PRIMARY KEY,
                    url VARCHAR(2048),
                    create_at DATETIME DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """)

    async def _fp_exists(self, fp: str):
        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT 1 FROM url_fingerprint WHERE fp=%s", (fp,))
                return await cur.fetchone() is not None

    async def _fp_insert(self, fp: str, url: str):
        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("INSERT IGNORE INTO url_fingerprint(fp,url) VALUES (%s,%s)", (fp, url))
                await conn.commit()

    async def save_item(self, item: CrawlResultItem):
        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("""
                INSERT IGNORE INTO crawl_result(url,title,publish_time,content,metadata)
                VALUES (%s,%s,%s,%s,%s)
                """, (item.url, item.title, item.publish_time, item.content, json.dumps(item.metadata)))
                await conn.commit()

    async def save_fail(self, task: CrawlTask, err_msg: str):
        async with self.pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute("INSERT INTO crawl_fail(url,depth,error) VALUES (%s,%s,%s)",
                                  (task.url, task.depth, err_msg))
            await conn.commit()

    async def check_seen(self, url: str, dedup_whitelist: List[str]) -> bool:
        if url in dedup_whitelist:
            return False
        fp = gen_url_fingerprint(url)
        return await self._fp_exists(fp)

    async def mark_seen(self, url: str):
        fp = gen_url_fingerprint(url)
        await self._fp_insert(fp, url)

    async def close(self):
        if self.pool:
            self.pool.close()
            await self.pool.wait_closed()

# ===================== 下载器层：支持POST‑Form‑Data + 代理池 =====================
class BaseDownloader:
    def __init__(self, config: CrawlerConfig, proxy_pool: Optional[ProxyPool] = None):
        self.config = config
        self.proxy_pool = proxy_pool
        self.headers: Dict[str, str] = {
            "User‑Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        }
        self.cookies: Dict[str, str] = {}
        self.timeout = config.task_timeout

    def set_headers(self, headers: Dict):
        self.headers.update(headers)

    def set_cookies(self, cookies: Dict):
        self.cookies.update(cookies)

    async def fetch(self, task: CrawlTask) -> str:
        raise NotImplementedError


class RequestsDownloader(BaseDownloader):
    async def fetch(self, task: CrawlTask) -> str:
        url = task.url
        proxy = await self.proxy_pool.get_proxy() if self.proxy_pool else None
        proxies = {"http": proxy, "https": proxy} if proxy else None
        try:
            method = task.method.upper()
            if method == "POST":
                if task.form_data is not None:
                    resp = requests.post(
                        url,
                        data=task.form_data,
                        headers=self.headers,
                        cookies=self.cookies,
                        proxies=proxies,
                        timeout=self.timeout,
                        allow_redirects=True
                    )
                elif task.post_body is not None:
                    resp = requests.post(
                        url,
                        json=task.post_body,
                        headers=self.headers,
                        cookies=self.cookies,
                        proxies=proxies,
                        timeout=self.timeout,
                        allow_redirects=True
                    )
                else:
                    resp = requests.post(
                        url,
                        headers=self.headers,
                        cookies=self.cookies,
                        proxies=proxies,
                        timeout=self.timeout,
                        allow_redirects=True
                    )
            else:
                resp = requests.get(
                    url,
                    headers=self.headers,
                    cookies=self.cookies,
                    proxies=proxies,
                    timeout=self.timeout,
                    allow_redirects=True
                )
            resp.raise_for_status()
            return resp.text
        except Exception as e:
            if self.proxy_pool and proxy:
                await self.proxy_pool.mark_bad(proxy)
            raise Exception(f"Requests fetch failed {url}, err:{str(e)}")


class PlaywrightDownloader(BaseDownloader):
    def __init__(self, config: CrawlerConfig, page: Page, proxy_pool: Optional[ProxyPool] = None, wait_idle: bool = True, wait_ms: int = 2000):
        super().__init__(config, proxy_pool)
        self.page = page
        self.wait_idle = wait_idle
        self.wait_ms = wait_ms

    async def fetch(self, task: CrawlTask) -> str:
        url = task.url
        for k, v in self.cookies.items():
            await self.page.context.add_cookies([{"name": k, "value": v, "url": url}])
        wait_until = "networkidle" if self.wait_idle else "domcontentloaded"
        await self.page.goto(url, timeout=self.timeout*1000, wait_until=wait_until)
        await asyncio.sleep(self.wait_ms / 1000)
        html = await self.page.content()
        return html

# ===================== Prometheus指标封装 =====================
class CrawlerMetrics:
    def __init__(self):
        if Counter is None:
            self.enabled = False
            return
        self.enabled = True
        self.crawl_total = Counter("crawl_total", "总任务数", ["status"])
        self.crawl_success = Counter("crawl_success_total", "成功采集")
        self.crawl_fail = Counter("crawl_fail_total", "采集失败")
        self.crawl_retry = Counter("crawl_retry_total", "重试次数")
        self.queue_size = Gauge("crawl_queue_size", "队列长度", ["queue"])
        self.crawl_rate = Summary("crawl_process_seconds", "处理耗时")

    def inc_total(self, status: str):
        if not self.enabled:
            return
        self.crawl_total.labels(status=status).inc()

    def inc_success(self):
        if not self.enabled:
            return
        self.crawl_success.inc()

    def inc_fail(self):
        if not self.enabled:
            return
        self.crawl_fail.inc()

    def inc_retry(self):
        if not self.enabled:
            return
        self.crawl_retry.inc()

    def set_queue(self, q_name: str, val: int):
        if not self.enabled:
            return
        self.queue_size.labels(queue=q_name).set(val)

    def observe_duration(self, sec: float):
        if not self.enabled:
            return
        self.crawl_rate.observe(sec)

    async def start_http_server(self, host: str, port: int):
        if not self.enabled or web is None:
            return
        async def metrics_handler(request):
            return web.Response(body=generate_latest(REGISTRY), content_type="text/plain; version=0.0.4")
        app = web.Application()
        app.add_routes([web.get("/metrics", metrics_handler)])
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, host, port)
        await site.start()
        print(f"Prometheus metrics listen on http://{host}:{port}/metrics")

# ===================== 调度核心 V5 =====================
class GenericSiteCrawler:
    def __init__(
        self,
        parser: BaseSiteParser,
        downloader: BaseDownloader,
        storage: BaseStorage,
        config: CrawlerConfig
    ):
        self.parser = parser
        self.downloader = downloader
        self.storage = storage
        self.cfg = config

        # 优先级队列：0最高，1普通，2低
        self.priority_queues: Dict[int, Deque[CrawlTask]] = {
            0: deque(),
            1: deque(),
            2: deque()
        }
        self.retry_queue: Deque[CrawlTask] = deque()

        self.processed_count = 0
        self.fail_count = 0
        self.start_ts: Optional[float] = None
        self.sem = asyncio.Semaphore(self.cfg.concurrency)

        # V5新增：重试队列独立协程，不抢占普通worker并发
        self._retry_worker_task: Optional[asyncio.Task] = None
        self._monitor_task: Optional[asyncio.Task] = None
        self._prom_server_task: Optional[asyncio.Task] = None

        # 令牌桶
        self.token_bucket = TokenBucket(self.cfg.token_bucket_rps, self.cfg.token_bucket_capacity)
        self.metrics = CrawlerMetrics()

        if self.cfg.enable_resume and os.path.exists(self.cfg.resume_file):
            self._load_resume()

    def add_seed(self, seed_url: str, tags: List[str] = None, extra: Dict = None,
                 method="GET", post_body=None, form_data=None, priority: int = 1):
        tags = tags or []
        extra = extra or {}
        nu = normalize_url(seed_url)
        task = CrawlTask(
            url=nu, depth=0, tags=tags, extra=extra,
            method=method, post_body=post_body, form_data=form_data,
            priority=priority, retry_count=0
        )
        self.priority_queues[task.priority].append(task)

    def add_seed_list(self, seed_list: List[str], priority: int = 1):
        for u in seed_list:
            self.add_seed(u, priority=priority)

    def _get_normal_task(self) -> Optional[CrawlTask]:
        """只获取普通优先级任务，不碰重试队列"""
        for p in [0, 1, 2]:
            q = self.priority_queues[p]
            if q:
                return q.popleft()
        return None

    def _save_resume(self):
        data = {
            "q0": [asdict(t) for t in self.priority_queues[0]],
            "q1": [asdict(t) for t in self.priority_queues[1]],
            "q2": [asdict(t) for t in self.priority_queues[2]],
            "retry_q": [asdict(t) for t in self.retry_queue],
            "processed_count": self.processed_count,
            "fail_count": self.fail_count
        }
        with open(self.cfg.resume_file, "w", encoding="utf‑8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_resume(self):
        with open(self.cfg.resume_file, "r", encoding="utf‑8") as f:
            data = json.load(f)
        self.processed_count = data.get("processed_count", 0)
        self.fail_count = data.get("fail_count", 0)
        for d in data.get("q0", []):
            self.priority_queues[0].append(CrawlTask(**d))
        for d in data.get("q1", []):
            self.priority_queues[1].append(CrawlTask(**d))
        for d in data.get("q2", []):
            self.priority_queues[2].append(CrawlTask(**d))
        for d in data.get("retry_q", []):
            self.retry_queue.append(CrawlTask(**d))
        print(f"[断点恢复] q0:{len(self.priority_queues[0])} q1:{len(self.priority_queues[1])} q2:{len(self.priority_queues[2])} retry_q:{len(self.retry_queue)}")

    def _get_domain_delay(self, url: str) -> float:
        host = get_root_host(url)
        return self.cfg.domain_delay_map.get(host, self.cfg.default_delay_sec)

    async def _monitor_loop(self):
        while True:
            await asyncio.sleep(self.cfg.monitor_interval)
            if self.start_ts is None:
                continue
            cost = time.time() - self.start_ts
            rate = self.processed_count / cost if cost > 0 else 0.0
            total = self.processed_count + self.fail_count
            fail_rate = (self.fail_count / total * 100) if total > 0 else 0.0
            q0 = len(self.priority_queues[0])
            q1 = len(self.priority_queues[1])
            q2 = len(self.priority_queues[2])
            rq = len(self.retry_queue)

            self.metrics.set_queue("q0_high", q0)
            self.metrics.set_queue("q1_normal", q1)
            self.metrics.set_queue("q2_low", q2)
            self.metrics.set_queue("retry_queue", rq)

            print(f"\n===== Monitor =====")
            print(f"已处理:{self.processed_count} 失败:{self.fail_count}")
            print(f"速率:{rate:.2f} task/s 失败率:{fail_rate:.2f}%")
            print(f"队列 0(高):{q0} 1:{q1} 2(低):{q2} 重试队列:{rq}")
            print(f"====================\n")

    async def _process_single_task(self, task: CrawlTask):
        """单个任务处理，带超时隔离"""
        start = time.time()
        try:
            seen = await self.storage.check_seen(task.url, self.cfg.dedup_whitelist)
            if seen:
                return
            await self.storage.mark_seen(task.url)

            html = await asyncio.wait_for(self.downloader.fetch(task), timeout=self.cfg.task_timeout)
            result: CrawlResultItem = self.parser.parse(html, task)
            await self.storage.save_item(result)
            self.processed_count += 1
            self.metrics.inc_success()
            self.metrics.inc_total("success")

            next_depth = task.depth + 1
            if next_depth <= self.cfg.max_depth:
                for link in result.out_links:
                    if not is_allow_domain(link, self.cfg.domain_whitelist, self.cfg.domain_blacklist):
                        continue
                    is_seen = await self.storage.check_seen(link, self.cfg.dedup_whitelist)
                    if is_seen:
                        continue
                    prio = 0 if "detail" in task.tags else 1
                    new_task = CrawlTask(
                        url=link,
                        depth=next_depth,
                        referer=task.url,
                        tags=task.tags.copy(),
                        extra=task.extra.copy(),
                        method="GET",
                        priority=prio
                    )
                    self.priority_queues[new_task.priority].append(new_task)

            if self.processed_count % 10 == 0 and self.cfg.enable_resume:
                self._save_resume()

        except Exception as e:
            err = str(e)
            print(f"[fail] {task.url} | {err}")
            # 失败重试逻辑
            if task.retry_count < self.cfg.max_retry:
                task.retry_count += 1
                self.metrics.inc_retry()
                backoff = self.cfg.retry_backoff_base ** task.retry_count
                print(f"[retry‑enqueue] {task.url} retry={task.retry_count}, backoff {backoff:.1f}s")
                self.retry_queue.append(task)
            else:
                self.fail_count += 1
                self.metrics.inc_fail()
                self.metrics.inc_total("fail")
                await self.storage.save_fail(task, err)
        finally:
            dur = time.time() - start
            self.metrics.observe_duration(dur)

    async def _normal_worker(self):
        """普通任务worker池，只消费优先级队列"""
        while True:
            if self.processed_count >= self.cfg.max_task_count:
                break
            task = self._get_normal_task()
            if task is None:
                await asyncio.sleep(0.2)
                continue
            await self.token_bucket.consume()
            async with self.sem:
                await self._process_single_task(task)
                delay = self._get_domain_delay(task.url)
                await asyncio.sleep(delay)

    async def _retry_worker_loop(self):
        """重试队列独立调度协程，不抢占普通worker的semaphore"""
        while True:
            if not self.retry_queue:
                await asyncio.sleep(0.5)
                continue
            task = self.retry_queue.popleft()
            backoff = self.cfg.retry_backoff_base ** task.retry_count
            await asyncio.sleep(backoff)
            await self.token_bucket.consume()
            await self._process_single_task(task)

    async def run(self):
        await self.storage.init()
        self.start_ts = time.time()

        # prometheus http服务
        if self.cfg.prometheus_enable:
            self._prom_server_task = asyncio.create_task(
                self.metrics.start_http_server(self.cfg.prometheus_host, self.cfg.prometheus_port)
            )

        self._monitor_task = asyncio.create_task(self._monitor_loop())
        self._retry_worker_task = asyncio.create_task(self._retry_worker_loop())

        print(f"[Crawler Start] concurrency={self.cfg.concurrency}, max_depth={self.cfg.max_depth}, max_task={self.cfg.max_task_count}")
        workers = [asyncio.create_task(self._normal_worker()) for _ in range(self.cfg.concurrency)]
        await asyncio.gather(*workers)

        # 普通任务全部结束，等待重试队列排空
        while self.retry_queue:
            await asyncio.sleep(0.5)

        if self._monitor_task:
            self._monitor_task.cancel()
        if self._retry_worker_task:
            self._retry_worker_task.cancel()

        if self.cfg.enable_resume:
            self._save_resume()
        await self.storage.close()

        cost_total = time.time() - self.start_ts
        print(f"\n[Crawler Done] processed={self.processed_count}, fail={self.fail_count}, cost={cost_total:.2f}s")

# ===================== DemoParser示例 =====================
class DemoParser(BaseSiteParser):
    def parse(self, html: str, task: CrawlTask) -> CrawlResultItem:
        doc = etree.HTML(html)
        title = ""
        t_nodes = doc.xpath("//title/text()")
        if t_nodes:
            title = t_nodes[0].strip()

        hrefs = doc.xpath("//a/@href")
        abs_links = extract_abs_links(task.url, hrefs)

        next_page = self.get_next_page(html, task.url)
        if next_page:
            abs_links.append(next_page)

        return CrawlResultItem(
            url=task.url,
            title=title,
            metadata={"depth": task.depth, "tags": task.tags, "priority": task.priority},
            out_links=abs_links
        )

# ===================== 入口示例 =====================
async def run_sqlite_demo():
    cfg = CrawlerConfig(
        max_depth=2,
        max_task_count=100,
        concurrency=2,
        default_delay_sec=1.0,
        domain_delay_map={
            "example.com": 2.0
        },
        domain_whitelist=["example.com"],
        max_retry=2,
        monitor_interval=10,
        dedup_whitelist=[
            "https://example.com/force‑fetch‑1",
        ],
        enable_resume=True,
        # V5配置
        task_timeout=30,
        proxy_pool=[
            "http://127.0.0.1:7890",
            "http://127.0.0.1:7891"
        ],
        prometheus_enable=True,
        prometheus_host="0.0.0.0",
        prometheus_port=8000,
        token_bucket_rps=2.0,
        token_bucket_capacity=5.0
    )
    parser = DemoParser()
    proxy_pool = ProxyPool(cfg.proxy_pool, health_check=True)
    downloader = RequestsDownloader(cfg, proxy_pool=proxy_pool)
    storage = SqliteStorage(cfg)
    crawler = GenericSiteCrawler(parser, downloader, storage, cfg)

    crawler.add_seed("https://example.com", tags=["list"], priority=1)
    crawler.add_seed("https://example.com/detail/1", tags=["detail"], priority=0)

    # POST‑Form‑Data
    # crawler.add_seed("https://xxx.com/login", method="POST", form_data={"username":"x","password":"x"})

    await crawler.run()


if __name__ == "__main__":
    asyncio.run(run_sqlite_demo())
