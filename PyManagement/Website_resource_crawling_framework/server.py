"""
基于 aiohttp 的异步 REST API 服务器
与 Python CrawlerEngine 及全部策略、工厂、观察者模块直接联动
提供给 Web 极客控制台
"""
import asyncio
import json
import os
import shutil
import time
import uuid
from typing import Any, Dict, List
from urllib.parse import urljoin, urlparse
import aiohttp
from aiohttp import web
from crawler_framework.core.models import CrawlTask, ResourceCategory
from crawler_framework.core.engine import CrawlerEngine
from crawler_framework.queues.factory import QueueFactory
from crawler_framework.parsers.factory import ParserFactory
from crawler_framework.decoders.charset_detector import CharsetDetector
from crawler_framework.storage.resource_classifier import ResourceClassifier
from crawler_framework.decryptors.factory import DecryptorFactory
from crawler_framework.observers.base import BaseObserver
from crawler_framework.observers.events import CrawlerEvent, EventType
from crawler_framework.downloaders.download_manager import DownloadManager
from crawler_framework.downloaders.video_extractor import VideoExtractor


@web.middleware
async def cors_middleware(request: web.Request, handler):
    """允许前端跨域访问本 API 与静态资源"""
    if request.method == "OPTIONS":
        resp = web.Response(status=204)
    else:
        resp = await handler(request)
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp

# 全局内存事件历史缓冲区
EVENT_HISTORY: List[Dict[str, Any]] = []
# 多引擎实例注册表：engine_id -> {engine, task, started_at, params, final_state, stop_requested}
ENGINES: Dict[str, Dict[str, Any]] = {}
MAX_RUNNING_ENGINES = 5   # 最大并行引擎数守卫上限
MAX_ENGINE_HISTORY = 20   # 已结束引擎的历史保留条数（先进先出回收）
DOWNLOAD_MANAGER = DownloadManager(concurrency=8, max_segments=1000)


class WebEventObserver(BaseObserver):
    """专门为 Web 收集事件的观察者（附带 engine_id 标识事件来源）"""

    def __init__(self, engine_id: str = "-"):
        self.engine_id = engine_id

    async def on_event(self, event: CrawlerEvent) -> None:
        rec = {
            "timestamp": event.timestamp,
            "type": event.event_type.value,
            "url": event.task.url if event.task else None,
            "message": event.message,
            "data": event.data,
            "status_code": event.response.status_code if event.response else None,
            "category": event.response.category.value if event.response else None,
            "encoding": event.response.encoding if event.response else None,
            "engine_id": self.engine_id,
        }
        EVENT_HISTORY.append(rec)
        if len(EVENT_HISTORY) > 300:
            EVENT_HISTORY.pop(0)


def _engine_state(engine_id: str) -> str:
    """引擎生命周期状态：running / stopped / finished / failed"""
    entry = ENGINES.get(engine_id)
    if not entry:
        return "unknown"
    if entry.get("task") is not None and not entry["task"].done():
        return "running"
    return entry.get("final_state") or "finished"


def _running_engine_ids() -> List[str]:
    return [eid for eid in ENGINES if _engine_state(eid) == "running"]


def _prune_engines() -> None:
    """回收已结束引擎历史：仅保留最近 MAX_ENGINE_HISTORY 条非运行记录"""
    finished = [(eid, e) for eid, e in ENGINES.items() if _engine_state(eid) != "running"]
    if len(finished) <= MAX_ENGINE_HISTORY:
        return
    finished.sort(key=lambda kv: kv[1]["started_at"])
    for eid, _ in finished[: len(finished) - MAX_ENGINE_HISTORY]:
        ENGINES.pop(eid, None)


def _spawn_engine(entry: Dict[str, Any], engine: "CrawlerEngine") -> None:
    """为引擎实例启动后台调度任务，并在结束时固化生命周期状态"""
    async def _runner():
        try:
            await engine.run()
        except asyncio.CancelledError:
            entry["final_state"] = "stopped"
            raise
        except Exception:
            entry["final_state"] = "failed"
            raise
        finally:
            # 记录结束时间戳（供前端展示总耗时）
            entry["ended_at"] = time.time()
            if not entry.get("final_state"):
                entry["final_state"] = "stopped" if entry.get("stop_requested") else "finished"
            _prune_engines()

    entry["task"] = asyncio.create_task(_runner())


async def _shutdown_engine(entry: Dict[str, Any], timeout: float = 5.0) -> None:
    """优雅停止单个引擎：先发停止信号，超时未退出则强制取消调度任务"""
    entry["stop_requested"] = True
    engine = entry.get("engine")
    task = entry.get("task")
    if engine is not None:
        engine.stop()
    if task is not None and not task.done():
        try:
            await asyncio.wait_for(asyncio.shield(task), timeout=timeout)
        except asyncio.TimeoutError:
            task.cancel()
        except asyncio.CancelledError:
            raise
        except Exception:
            pass
    if not entry.get("final_state"):
        entry["final_state"] = "stopped"


async def handle_status(request: web.Request) -> web.Response:
    """聚合全部引擎实例的状态指标（保持原有顶层字段兼容）"""
    engines_payload: List[Dict[str, Any]] = []
    queue_stats = {"pending": 0, "processing": 0, "completed": 0, "failed": 0}
    pages_crawled = 0
    max_pages = 0

    for eid, entry in ENGINES.items():
        engine = entry.get("engine")
        state = _engine_state(eid)
        e_pages = getattr(engine, "pages_crawled", 0) or 0
        e_max = getattr(engine, "max_pages", 0) or 0
        pages_crawled += e_pages
        max_pages += e_max
        if engine is not None and getattr(engine, "queue", None) is not None:
            try:
                st = await engine.queue.get_stats()
                for k in queue_stats:
                    queue_stats[k] += st.get(k, 0) or 0
            except Exception:
                pass
        engines_payload.append({
            "engine_id": eid,
            "state": state,
            "started_at": entry.get("started_at"),
            "ended_at": entry.get("ended_at"),
            "pages_crawled": e_pages,
            "max_pages": e_max,
            "params": entry.get("params", {}),
        })

    running_ids = _running_engine_ids()
    return web.json_response({
        "status": "success",
        "running": bool(running_ids),
        "running_count": len(running_ids),
        "pages_crawled": pages_crawled,
        "max_pages": max_pages,
        "queue_stats": queue_stats,
        "engines": engines_payload,
        "recent_events_count": len(EVENT_HISTORY),
    })


async def handle_resources(request: web.Request) -> web.Response:
    """扫描本地 downloads 目录，返回分类资源清单（供前端预览/播放）"""
    downloads_dir = os.path.abspath("downloads")
    category = request.query.get("category", "").strip().lower()
    result = []

    if os.path.isdir(downloads_dir):
        for cat in os.listdir(downloads_dir):
            cat_path = os.path.join(downloads_dir, cat)
            if not os.path.isdir(cat_path):
                continue
            if category and cat.lower() != category:
                continue
            for fname in os.listdir(cat_path):
                fpath = os.path.join(cat_path, fname)
                if not os.path.isfile(fpath):
                    continue
                try:
                    size = os.path.getsize(fpath)
                except OSError:
                    size = 0
                ext = os.path.splitext(fname)[1].lower().lstrip(".")
                result.append({
                    "name": fname,
                    "category": cat,
                    "ext": ext,
                    "size": size,
                    "url": f"/downloads/{cat}/{fname}",
                    "preview_type": _preview_type(cat, ext),
                })

    # 按分类、名称排序
    result.sort(key=lambda x: (x["category"], x["name"]))
    return web.json_response({
        "status": "success",
        "count": len(result),
        "resources": result,
    })


def _preview_type(category: str, ext: str) -> str:
    """判断资源在前端的预览方式：image / video / audio / text / other"""
    img_exts = {"png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"}
    vid_exts = {"mp4", "webm", "ogg", "mov", "mkv", "m4v"}
    aud_exts = {"mp3", "wav", "flac", "aac", "ogg", "m4a"}
    txt_exts = {"txt", "json", "xml", "csv", "log", "md", "css", "js", "ts", "html", "htm"}
    if category == "images" or ext in img_exts:
        return "image"
    if category == "videos" or ext in vid_exts:
        return "video"
    if category == "audios" or ext in aud_exts:
        return "audio"
    if ext in txt_exts:
        return "text"
    return "other"


async def handle_events(request: web.Request) -> web.Response:
    limit = int(request.query.get("limit", 100))
    return web.json_response({
        "status": "success",
        "events": EVENT_HISTORY[-limit:]
    })


async def handle_start(request: web.Request) -> web.Response:
    """创建新的抓取引擎实例（支持多引擎并行，带最大并行数守卫）"""
    data = await request.json()
    urls = data.get("urls", ["https://www.169tp.com/"])
    queue_mode = data.get("queue_mode", "memory")
    default_parser = data.get("default_parser", "xpath")
    concurrency = int(data.get("concurrency", 5))
    max_depth = int(data.get("max_depth", 2))
    max_pages = int(data.get("max_pages", 30))
    auto_follow_pagination = bool(data.get("auto_follow_pagination", True))
    same_domain_only = bool(data.get("same_domain_only", True))
    request_delay = max(0.0, float(data.get("request_delay", 1.0)))

    engine_id = f"engine-{uuid.uuid4().hex[:8]}"
    # SQLite 模式默认按引擎隔离数据库文件，避免多引擎共用一个队列互相污染
    db_path = data.get("db_path") or (
        f"crawler_tasks_{engine_id}.db" if queue_mode == "sqlite" else "crawler_tasks.db"
    )

    # 启动守卫：最大并行引擎数上限
    running_ids = _running_engine_ids()
    if len(running_ids) >= MAX_RUNNING_ENGINES:
        return web.json_response({
            "status": "error",
            "message": f"已达最大并行引擎数上限({MAX_RUNNING_ENGINES})，请先停止部分引擎",
            "running_engines": running_ids,
        }, status=409)

    # 自动推断允许的域名（根据种子 URL 的根域名）
    allowed_domains = data.get("allowed_domains") or []
    if not allowed_domains and urls:
        for u in urls:
            try:
                host = urlparse(u).hostname or ""
                parts = host.split(".")
                if len(parts) >= 2:
                    root_d = ".".join(parts[-2:])
                    if root_d and root_d not in allowed_domains:
                        allowed_domains.append(root_d)
            except Exception:
                pass

    engine = CrawlerEngine(
        queue_mode=queue_mode,
        db_path=db_path,
        default_parser=default_parser,
        concurrency=concurrency,
        max_depth=max_depth,
        max_pages=max_pages,
        auto_follow_links=True,
        auto_follow_pagination=auto_follow_pagination,
        same_domain_only=same_domain_only,
        allowed_domains=allowed_domains,
        request_delay=request_delay,
        enable_console_log=True,
    )
    engine.add_observer(WebEventObserver(engine_id))

    for u in urls:
        if u.strip():
            await engine.add_url(u.strip(), depth=0, priority=10)

    entry: Dict[str, Any] = {
        "engine": engine,
        "task": None,
        "started_at": time.time(),
        "params": {
            "urls": urls,
            "queue_mode": queue_mode,
            "default_parser": default_parser,
            "concurrency": concurrency,
            "max_depth": max_depth,
            "max_pages": max_pages,
            "request_delay": request_delay,
            "auto_follow_pagination": auto_follow_pagination,
            "same_domain_only": same_domain_only,
            "db_path": db_path,
            "allowed_domains": allowed_domains,
        },
        "final_state": None,
        "stop_requested": False,
    }
    ENGINES[engine_id] = entry
    _spawn_engine(entry, engine)

    return web.json_response({
        "status": "success",
        "message": (
            f"引擎 {engine_id} 已启动！深度={max_depth} | 页数={max_pages} | "
            f"域名间隔={request_delay}s | 队列={queue_mode} | 域名限定={allowed_domains}"
        ),
        "engine_id": engine_id,
        "queue_mode": queue_mode,
        "max_pages": max_pages,
        "max_depth": max_depth,
        "request_delay": request_delay,
        "allowed_domains": allowed_domains,
    })


async def handle_stop(request: web.Request) -> web.Response:
    """停止引擎：指定 engine_id 停止单个，缺省停止全部运行中引擎"""
    try:
        data = await request.json()
    except Exception:
        data = {}
    engine_id = str(data.get("engine_id") or "").strip()

    if engine_id:
        entry = ENGINES.get(engine_id)
        if entry is None:
            return web.json_response({
                "status": "error",
                "message": f"引擎 {engine_id} 不存在",
                "engines": list(ENGINES.keys()),
            }, status=404)
        if _engine_state(engine_id) != "running":
            return web.json_response({"status": "error", "message": f"引擎 {engine_id} 当前未运行"})
        await _shutdown_engine(entry)
        return web.json_response({"status": "success", "message": f"引擎 {engine_id} 已停止"})

    running = [(eid, e) for eid, e in list(ENGINES.items()) if _engine_state(eid) == "running"]
    if not running:
        return web.json_response({"status": "error", "message": "当前无运行中的引擎"})
    await asyncio.gather(*(_shutdown_engine(e) for _, e in running))
    stopped_ids = [eid for eid, _ in running]
    return web.json_response({
        "status": "success",
        "message": f"已停止 {len(stopped_ids)} 个引擎: {', '.join(stopped_ids)}",
        "stopped": stopped_ids,
    })


async def handle_resume(request: web.Request) -> web.Response:
    """断点续爬：重置指定（或最近一个）SQLite 引擎的中断任务并重新拉起调度"""
    try:
        data = await request.json()
    except Exception:
        data = {}
    engine_id = str(data.get("engine_id") or "").strip()

    # 定位目标引擎：指定 id，或最近一个 SQLite 队列引擎
    if engine_id:
        target = ENGINES.get(engine_id)
        if target is None:
            return web.json_response({
                "status": "error",
                "message": f"引擎 {engine_id} 不存在",
                "engines": list(ENGINES.keys()),
            }, status=404)
        if target.get("params", {}).get("queue_mode") != "sqlite":
            return web.json_response({
                "status": "error",
                "message": f"引擎 {engine_id} 不是 SQLite 持久化队列，无法断点续爬",
            })
    else:
        sqlite_engines = [
            (eid, e) for eid, e in ENGINES.items()
            if e.get("params", {}).get("queue_mode") == "sqlite"
        ]
        if not sqlite_engines:
            return web.json_response({
                "status": "error",
                "message": "当前无 SQLite 持久化队列引擎，无法断点续爬",
            })
        sqlite_engines.sort(key=lambda kv: kv[1]["started_at"])
        engine_id, target = sqlite_engines[-1]

    if _engine_state(engine_id) == "running":
        return web.json_response({
            "status": "error",
            "message": f"引擎 {engine_id} 正在运行中，无需断点续爬",
        })

    # 重置该引擎数据库中残留的 processing 任务为 pending
    db_path = target.get("params", {}).get("db_path", "crawler_tasks.db")
    queue = QueueFactory.create_queue(mode="sqlite", db_path=db_path)
    await queue.initialize()
    reset_count = await queue.reset_processing()
    stats = await queue.get_stats()
    await queue.close()

    if not stats.get("pending"):
        return web.json_response({
            "status": "success",
            "message": f"引擎 {engine_id} 队列当前无待续爬任务（已重置 {reset_count} 个中断任务）",
            "engine_id": engine_id,
            "reset_count": reset_count,
            "queue_stats": stats,
        })

    # 以原引擎参数重新拉起调度（复用同一 SQLite 队列文件，无需重新投递种子）
    running_ids = _running_engine_ids()
    if len(running_ids) >= MAX_RUNNING_ENGINES:
        return web.json_response({
            "status": "error",
            "message": f"已达最大并行引擎数上限({MAX_RUNNING_ENGINES})，无法拉起续爬",
            "running_engines": running_ids,
        }, status=409)

    params = target.get("params", {})
    new_id = f"engine-{uuid.uuid4().hex[:8]}"
    engine = CrawlerEngine(
        queue_mode="sqlite",
        db_path=db_path,
        default_parser=params.get("default_parser", "xpath"),
        concurrency=params.get("concurrency", 5),
        max_depth=params.get("max_depth", 2),
        max_pages=params.get("max_pages", 30),
        auto_follow_links=True,
        auto_follow_pagination=params.get("auto_follow_pagination", True),
        same_domain_only=params.get("same_domain_only", True),
        allowed_domains=params.get("allowed_domains") or [],
        request_delay=params.get("request_delay", 1.0),
        enable_console_log=True,
    )
    engine.add_observer(WebEventObserver(new_id))

    entry: Dict[str, Any] = {
        "engine": engine,
        "task": None,
        "started_at": time.time(),
        "params": {**params, "resumed_from": engine_id},
        "final_state": None,
        "stop_requested": False,
    }
    ENGINES[new_id] = entry
    _spawn_engine(entry, engine)

    return web.json_response({
        "status": "success",
        "message": f"断点续爬成功：引擎 {engine_id} 已重置 {reset_count} 个中断任务，续爬引擎 {new_id} 已启动",
        "engine_id": new_id,
        "resumed_from": engine_id,
        "reset_count": reset_count,
        "queue_stats": stats,
    })


async def handle_test_charset(request: web.Request) -> web.Response:
    data = await request.json()
    test_type = data.get("type", "gbk")
    custom_text = data.get("text", "这是一段中文新闻：GBK/UTF-8自动识别测试！")

    if test_type == "gbk":
        raw_bytes = f"<html><head><meta charset='gbk'></head><body><h1>{custom_text}</h1></body></html>".encode("gbk")
        content_type = "text/html; charset=gbk"
    else:
        raw_bytes = f"<html><head><meta charset='utf-8'></head><body><h1>{custom_text}</h1></body></html>".encode("utf-8")
        content_type = "text/html; charset=utf-8"

    decoded_text, detected_enc = CharsetDetector.decode(raw_bytes, content_type)

    return web.json_response({
        "status": "success",
        "original_encoding": test_type,
        "detected_encoding": detected_enc,
        "decoded_preview": decoded_text,
        "raw_bytes_len": len(raw_bytes),
        "no_garbled": custom_text in decoded_text
    })


async def handle_test_parser(request: web.Request) -> web.Response:
    data = await request.json()
    html = data.get("html", "<html><head><title>测试</title></head><body><h1>标题内容</h1><a href='/link1'>链接1</a></body></html>")
    parser_type = data.get("parser_type", "xpath")
    rules = data.get("rules", {"title": "//h1/text()"} if parser_type == "xpath" else {"title": "h1"})
    base_url = data.get("base_url", "https://example.com")

    parser = ParserFactory.get_parser(parser_type)
    res = parser.parse(html, base_url, rules)

    return web.json_response({
        "status": "success",
        "parser_used": parser.name,
        "extracted_data": res.data,
        "extracted_urls": res.extracted_urls,
        "resource_urls": res.resource_urls,
    })


async def handle_real_fetch(request: web.Request) -> web.Response:
    """真实抓取指定 URL：服务端请求目标站点（绕过浏览器 CORS），
    智能识别字符集解码，并解析提取页面中的真实资源（图片/视频/音频/链接）"""
    try:
        data = await request.json()
        target_url = (data.get("url") or "").strip()
        if not target_url:
            return web.json_response({"status": "error", "message": "缺少 url 参数"}, status=400)
        if not target_url.startswith(("http://", "https://")):
            target_url = "https://" + target_url

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(target_url, headers=headers, allow_redirects=True) as resp:
                status_code = resp.status
                content_type = resp.headers.get("Content-Type", "")
                raw = await resp.read()

        # 智能字符集解码
        detector = CharsetDetector()
        decoded_text, encoding = detector.decode(raw, content_type)

        # 解析页面提取真实资源
        images: List[Dict[str, Any]] = []
        videos: List[Dict[str, Any]] = []
        audios: List[Dict[str, Any]] = []
        links: List[str] = []

        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(decoded_text, "html.parser")
            base = target_url

            for img in soup.find_all(["img", "amp-img"]):
                src = img.get("src") or img.get("data-src") or img.get("data-original") or img.get("data-lazy-src") or ""
                if src:
                    abs_url = urljoin(base, src.strip())
                    if abs_url.startswith("http"):
                        images.append({
                            "url": abs_url,
                            "alt": (img.get("alt") or "")[:60],
                        })

            for vid in soup.find_all(["video", "source"]):
                src = vid.get("src") or ""
                if src:
                    abs_url = urljoin(base, src.strip())
                    if abs_url.startswith("http"):
                        videos.append({"url": abs_url})
            for au in soup.find_all(["audio", "source"]):
                src = au.get("src") or ""
                if src and au.name == "audio":
                    abs_url = urljoin(base, src.strip())
                    if abs_url.startswith("http"):
                        audios.append({"url": abs_url})

            for a in soup.find_all("a", href=True):
                abs_url = urljoin(base, a["href"].strip())
                if abs_url.startswith("http") and abs_url != target_url:
                    links.append(abs_url)
        except Exception as parse_err:
            return web.json_response({
                "status": "error",
                "message": f"页面解析失败: {parse_err}",
            }, status=200)

        # 流媒体视频地址识别（HLS/DASH/FLV/RTMP/RTSP/WebRTC）
        stream_urls = VideoExtractor.extract(decoded_text, target_url)

        # 去重
        def dedupe(lst):
            seen = set()
            out = []
            for it in lst:
                key = it["url"] if isinstance(it, dict) else it
                if key not in seen:
                    seen.add(key)
                    out.append(it)
            return out

        images = dedupe(images)[:30]
        videos = dedupe(videos)[:10]
        audios = dedupe(audios)[:10]
        links = dedupe(links)[:20]

        return web.json_response({
            "status": "ok",
            "url": target_url,
            "final_url": target_url,
            "http_status": status_code,
            "encoding": encoding,
            "content_type": content_type,
            "size_bytes": len(raw),
            "title": ((BeautifulSoup(decoded_text, "html.parser").title.string if BeautifulSoup(decoded_text, "html.parser").title else "") or "").strip()[:120] if decoded_text else "",
            "resources": {
                "images": images,
                "videos": videos,
                "audios": audios,
                "links": links,
                "stream_urls": stream_urls,
            },
            "total": len(images) + len(videos) + len(audios) + len(stream_urls),
        })
    except asyncio.TimeoutError:
        return web.json_response({"status": "error", "message": "抓取超时（目标站点响应过慢）"}, status=200)
    except Exception as e:
        return web.json_response({"status": "error", "message": f"抓取失败: {str(e)}"}, status=200)


async def handle_test_decrypt(request: web.Request) -> web.Response:
    data = await request.json()
    algo = data.get("algo", "base64")
    ciphertext = data.get("ciphertext", "")
    params = data.get("params", {})

    decryptor = DecryptorFactory.create_decryptor(algo)
    if not decryptor:
        return web.json_response({"status": "error", "message": f"未知的解密算法: {algo}"})

    try:
        decrypted = decryptor.decrypt(ciphertext, params)
        return web.json_response({
            "status": "success",
            "algo": algo,
            "decrypted": decrypted
        })
    except Exception as e:
        return web.json_response({
            "status": "error",
            "message": f"解密失败: {str(e)}"
        })


async def handle_m3u8_download(request: web.Request) -> web.Response:
    """创建 M3U8 流媒体下载任务，后台异步执行切片解析、下载与合并"""
    data = await request.json()
    url = (data.get("url") or "").strip()
    referer = (data.get("referer") or "").strip()
    if not url:
        return web.json_response({"status": "error", "message": "缺少 url 参数"}, status=400)
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    task = DOWNLOAD_MANAGER.create_task(url=url, referer=referer)
    asyncio.create_task(DOWNLOAD_MANAGER.run_task(task))
    return web.json_response({"status": "success", "task": task.to_dict()})


async def handle_m3u8_tasks(request: web.Request) -> web.Response:
    """列出所有下载任务及其进度"""
    tasks = [t.to_dict() for t in DOWNLOAD_MANAGER.list_tasks()]
    return web.json_response({"status": "success", "count": len(tasks), "tasks": tasks})


async def handle_m3u8_task(request: web.Request) -> web.Response:
    """查询单个下载任务详情"""
    task_id = request.match_info.get("task_id")
    task = DOWNLOAD_MANAGER.get_task(task_id)
    if not task:
        return web.json_response({"status": "error", "message": "任务不存在"}, status=404)
    return web.json_response({"status": "success", "task": task.to_dict()})


async def handle_m3u8_cancel(request: web.Request) -> web.Response:
    """取消下载任务"""
    task_id = request.match_info.get("task_id")
    ok = DOWNLOAD_MANAGER.cancel_task(task_id)
    return web.json_response({
        "status": "success" if ok else "error",
        "message": "已取消" if ok else "任务不存在或当前状态不可取消",
    })


CLEANUP_CATEGORIES = {
    "images", "videos", "audios", "documents", "archives", "code", "data", "others",
}


async def handle_cleanup(request: web.Request) -> web.Response:
    """清理 downloads 目录：按白名单分类或全部删除已下载文件（含 M3U8 合并 .ts 与切片缓存）"""
    try:
        data = await request.json()
    except Exception:
        data = {}
    category = str(data.get("category") or "all").strip().lower()

    if category != "all" and category not in CLEANUP_CATEGORIES:
        return web.json_response({
            "status": "error",
            "message": f"Invalid cleanup category: {category}",
            "allowed": ["all"] + sorted(CLEANUP_CATEGORIES),
        }, status=400)

    downloads_dir = os.path.abspath("downloads")
    if category != "all":
        targets = [os.path.join(downloads_dir, category)]
    else:
        if not os.path.isdir(downloads_dir):
            return web.json_response({"status": "success", "category": category, "deleted_files": 0, "freed_bytes": 0, "errors": 0})
        targets = [
            os.path.join(downloads_dir, name)
            for name in os.listdir(downloads_dir)
            if os.path.isdir(os.path.join(downloads_dir, name))
        ]

    deleted = 0
    freed = 0
    errors = 0
    for target in targets:
        if not os.path.isdir(target):
            continue
        for fname in os.listdir(target):
            fpath = os.path.join(target, fname)
            if not os.path.isfile(fpath):
                continue
            try:
                freed += os.path.getsize(fpath)
                os.remove(fpath)
                deleted += 1
            except OSError:
                errors += 1

    return web.json_response({
        "status": "success",
        "category": category,
        "deleted_files": deleted,
        "freed_bytes": freed,
        "errors": errors,
    })


def make_app() -> web.Application:
    app = web.Application(middlewares=[cors_middleware])
    app.router.add_get("/api/status", handle_status)
    app.router.add_get("/api/events", handle_events)
    app.router.add_get("/api/resources", handle_resources)
    app.router.add_post("/api/start", handle_start)
    app.router.add_post("/api/stop", handle_stop)
    app.router.add_post("/api/resume", handle_resume)
    app.router.add_post("/api/cleanup", handle_cleanup)
    app.router.add_post("/api/test-charset", handle_test_charset)
    app.router.add_post("/api/test-parser", handle_test_parser)
    app.router.add_post("/api/test-decrypt", handle_test_decrypt)
    app.router.add_post("/api/real-fetch", handle_real_fetch)
    # M3U8 流媒体下载任务
    app.router.add_post("/api/m3u8/download", handle_m3u8_download)
    app.router.add_get("/api/m3u8/tasks", handle_m3u8_tasks)
    app.router.add_get("/api/m3u8/task/{task_id}", handle_m3u8_task)
    app.router.add_post("/api/m3u8/task/{task_id}/cancel", handle_m3u8_cancel)

    # 静态资源服务：将本地 downloads 目录暴露给前端预览/播放
    downloads_dir = os.path.abspath("downloads")
    os.makedirs(downloads_dir, exist_ok=True)
    app.router.add_static("/downloads", downloads_dir, show_index=False)
    return app


if __name__ == "__main__":
    app = make_app()
    web.run_app(app, host="0.0.0.0", port=8000)
