"""SpiderBuf 关卡签名器（solver）。

每个 solver 是 async 函数：async def solver(task, fetcher) -> Optional[FetchResult]
- 完成该关卡所需的多步请求与签名
- 返回 FetchResult 交给引擎统一解析管线；返回 None 表示交给默认抓取
- 基于已在 spiders/ 中实测通过的算法移植（c07 key 随机化顺序、c10 双 Cookie 等）

注意：fetcher 使用 aiohttp session，Cookie 自动保持，与 requests.Session 等价。
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import random
import string
import time
from typing import Any, Dict, Optional

from core.crypto import md5_hex
from core.encoding import decode_bytes
from core.fetcher import Fetcher, FetchResult
from core.models import Task

REFERER = "https://spiderbuf.cn/challenges"

_CHARSET = string.ascii_letters + string.digits


def _random_key(length: int = 32) -> str:
    return "".join(random.choice(_CHARSET) for _ in range(length))


async def _sleep() -> None:
    """礼貌抓取：每请求间隔 >=1s。"""
    await asyncio.sleep(1.0)


# ---------------------------------------------------------------- c01 Cookie
async def c01_solver(task: Task, fetcher: Fetcher) -> Optional[FetchResult]:
    """先 GET 关卡页触发 __cgf3t Cookie 下发，再 GET /mnist 数据页。"""
    base = task.url
    page = await fetcher.fetch(base, headers=task.headers, referer=REFERER)
    await _sleep()
    resp = await fetcher.fetch(base + "/mnist", headers=task.headers, referer=base)
    return resp


# ---------------------------------------------------------------- c03 防重放签名
async def c03_solver(task: Task, fetcher: Fetcher) -> Optional[FetchResult]:
    """POST 签名 JSON：xorResult=i^ts，hash=md5(f"{xor}{ts}")。"""
    i = int(task.extra.get("page", 1))
    timestamp = int(time.time())
    xor_result = i ^ timestamp
    sign = md5_hex(f"{xor_result}{timestamp}")
    payload = {"random": random.randint(2000, 10000),
               "timestamp": timestamp, "hash": sign, "xorResult": xor_result}
    resp = await fetcher.fetch(task.url, method="POST", json=payload,
                               headers=task.headers, referer=REFERER)
    return resp


# ---------------------------------------------------------------- c06 行为校验
async def c06_solver(task: Task, fetcher: Fetcher) -> Optional[FetchResult]:
    """GET 拿 _asd2sdf99 Cookie，再 POST 签名 JSON。"""
    await fetcher.fetch(task.url, headers=task.headers, referer=REFERER)
    await _sleep()
    timestamp = int(time.time())
    sign = md5_hex(f"{3006}spiderbuf{timestamp}")
    payload = {"random": 3006, "signture": sign, "timestamp": timestamp}
    resp = await fetcher.fetch(task.url, method="POST", json=payload,
                               headers=task.headers, referer=task.url)
    return resp


# ---------------------------------------------------------------- c07 token+key
async def c07_solver(task: Task, fetcher: Fetcher) -> Optional[FetchResult]:
    """GET 拿 token → 随机 key → md5(f"{ts}{token}{key}") 作 Cookie → POST。"""
    page = await fetcher.fetch(task.url, headers=task.headers, referer=REFERER)
    if page.status in (403, 408, 425, 429, 500, 502, 503, 504):
        raise RuntimeError(f"c07 限流/服务端错误 HTTP {page.status}（可重试）")
    token = ""
    if "<input" in page.text:
        from lxml import etree
        root = etree.HTML(page.text)
        nodes = root.xpath('//input[@id="token"]/@value')
        token = nodes[0] if nodes else ""
    if not token:
        raise RuntimeError("c07 未取到 token")
    key = _random_key(32)
    timestamp = int(time.time())
    sign = md5_hex(f"{timestamp}{token}{key}")
    # aiohttp 不支持 headers 里的 Cookie 头，必须写入 cookie_jar
    fetcher.session.cookie_jar.update_cookies({"_asd2sdf99": sign})
    payload = {"key": key, "token": token, "timestamp": timestamp}
    resp = await fetcher.fetch(task.url, method="POST", json=payload,
                               headers=task.headers, referer=task.url)
    return resp


# ---------------------------------------------------------------- c10 双 Cookie
async def c10_solver(task: Task, fetcher: Fetcher) -> Optional[FetchResult]:
    """模拟 Cloudflare：解析 __jsluid_h=<a>-<b>，构造
    __jsl_clearance=ts-md5(ts+b) 双 Cookie 重放。"""
    page = await fetcher.fetch(task.url, headers=task.headers, referer=REFERER)
    cookie = page.headers.get("set-cookie", "")
    jsl = ""
    for part in cookie.split(","):
        part = part.strip()
        if part.startswith("__jsluid_h="):
            jsl = part.split(";")[0].split("=", 1)[1]
            break
    if not jsl:
        # 有的部署直接把 __jsluid_h 写进 Set-Cookie 首部，解析失败时尝试再次请求
        raise RuntimeError(f"c10 未解析到 __jsluid_h: {cookie[:200]}")
    if "-" not in jsl:
        raise RuntimeError(f"c10 __jsluid_h 格式异常: {jsl}")
    _a, b = jsl.split("-", 1)
    ts = int(time.time())
    clearance = f"{ts}-{md5_hex(f'{ts}{b}')}"
    fetcher.session.cookie_jar.update_cookies(
        {"__jsluid_h": jsl, "__jsl_clearance": clearance})
    await _sleep()
    resp = await fetcher.fetch(task.url, headers=task.headers, referer=task.url)
    return resp


# ---------------------------------------------------------------- h05 md5+btoa
async def h05_solver(task: Task, fetcher: Fetcher) -> Optional[FetchResult]:
    """md5(秒级时间戳) → btoa(ts,md5) → GET /api/<payload>（路径拼接）。"""
    ts = str(int(time.time()))
    digest = md5_hex(ts)
    import base64
    payload = base64.b64encode(f"{ts},{digest}".encode()).decode()
    api_url = task.url.rstrip("/") + "/" + payload
    resp = await fetcher.fetch(api_url, headers=task.headers, referer=REFERER)
    return resp


# ---------------------------------------------------------------- c08 HMAC+AES
async def c08_solver(task: Task, fetcher: Fetcher) -> Optional[FetchResult]:
    """GET 页面取 salt → HMAC-SHA256(key=base_url, msg=salt+ts) 头 →
    响应 AES-128-CBC 密文（IV=前16字节）→ 解密后回填为可解析文本。"""
    from core import crypto
    page = await fetcher.fetch(task.url, headers=task.headers, referer=REFERER)
    salt = ""
    if "salt" in page.text:
        import re as _re
        m = _re.search(r'["\']salt["\']\s*[:=]\s*["\']([^"\']+)["\']', page.text)
        if m:
            salt = m.group(1)
    if not salt:
        raise RuntimeError("c08 未取到 salt")
    ts = str(int(time.time()))
    sign = crypto.hmac_hex(task.url, f"{salt}{ts}", algo="sha256")
    headers = dict(task.headers or {})
    headers["X-Sign"] = sign
    headers["X-Timestamp"] = ts
    raw_resp = await fetcher.fetch(task.url + "/api", headers=headers, referer=task.url)
    try:
        plain = crypto.aes_cbc_decrypt(raw_resp.raw, key=salt.encode(),
                                       iv_prefix=True)
    except Exception:  # noqa: BLE001
        # 兼容：响应可能为明文 JSON
        return raw_resp
    text, enc = decode_bytes(plain, raw_resp.headers)
    return FetchResult(status=raw_resp.status, headers=raw_resp.headers,
                       raw=plain, text=text, encoding=enc,
                       final_url=raw_resp.final_url)


# ---------------------------------------------------------------- c09 HMAC+XOR
async def c09_solver(task: Task, fetcher: Fetcher) -> Optional[FetchResult]:
    """固定指纹 hex + X-Client-Id + HMAC(key=token) 头，XOR 解 CPC。"""
    from core import crypto
    page = await fetcher.fetch(task.url, headers=task.headers, referer=REFERER)
    token = ""
    if "token" in page.text:
        import re as _re
        m = _re.search(r'["\']token["\']\s*[:=]\s*["\']([^"\']+)["\']', page.text)
        if m:
            token = m.group(1)
    if not token:
        raise RuntimeError("c09 未取到 token")
    fingerprint = _random_key(16)
    ts = str(int(time.time()))
    sign = crypto.hmac_hex(token, f"{fingerprint}{ts}", algo="sha256")
    headers = dict(task.headers or {})
    headers.update({"X-Fingerprint": fingerprint, "X-Client-Id": token,
                    "X-Sign": sign, "X-Timestamp": ts})
    resp = await fetcher.fetch(task.url + "/api", headers=headers, referer=task.url)
    return resp


# ---------------------------------------------------------------- c11 双重 HMAC
async def c11_solver(task: Task, fetcher: Fetcher) -> Optional[FetchResult]:
    """主线程 cookie(key=t) + Worker 算 s 参数(key=tt)，t/tt 间隔>=1s。

    GET /api?chip&currency&memory&t&tt&s；cookie 名为 t，值为 urlencode(sig1)。
    遍历 M4 × USD/EUR × 16GB/24GB 共 4 组，合并 JSON 返回。
    """
    import base64 as _b64
    import hmac as _hmac_mod
    import hashlib as _hashlib
    import urllib.parse as _uparse

    await fetcher.fetch(task.url, headers=task.headers, referer="https://spiderbuf.cn/")
    await _sleep()
    all_rows: list = []
    for chip in ["M4"]:
        for currency in ["USD", "EUR"]:
            for memory in ["16GB", "24GB"]:
                t = str(int(time.time()))
                await asyncio.sleep(1.0)  # t/tt 间隔 >=1s
                tt = str(int(time.time()))
                msg = f"{currency}{chip}{memory}{t}".encode()
                sig1 = _b64.b64encode(
                    _hmac_mod.new(t.encode(), msg, _hashlib.sha256).digest()).decode()
                sig2 = _b64.b64encode(
                    _hmac_mod.new(tt.encode(), msg, _hashlib.sha256).digest()).decode()
                fetcher.session.cookie_jar.update_cookies({t: _uparse.quote(sig1)})
                params = {"chip": chip, "currency": currency, "memory": memory,
                          "t": t, "tt": tt, "s": sig2}
                qs = _uparse.urlencode(params)
                r = await fetcher.fetch(f"{task.url}/api?{qs}",
                                        headers=task.headers, referer=task.url)
                try:
                    all_rows.extend(json.loads(r.text))
                except json.JSONDecodeError:
                    logger = __import__("logging").getLogger(__name__)
                    logger.warning("c11 响应非 JSON: %s", r.text[:200])
                await _sleep()
    raw = json.dumps(all_rows, ensure_ascii=False).encode("utf-8")
    return FetchResult(status=200, headers={}, raw=raw,
                       text=raw.decode("utf-8"), encoding="utf-8",
                       final_url=task.url)


# ---------------------------------------------------------------- n03 限频分页
async def n03_solver(task: Task, fetcher: Fetcher) -> Optional[FetchResult]:
    """严格 >=1s 限频分页（20 页由挑战页展开，每页 1 任务）。"""
    page = int(task.extra.get("page", 1))
    await asyncio.sleep(1.2)
    url = f"{task.url}?pageno={page}" if page > 1 else task.url
    resp = await fetcher.fetch(url, headers=task.headers, referer=REFERER)
    return resp


# ---------------------------------------------------------------- s04 分页
async def s04_solver(task: Task, fetcher: Fetcher) -> Optional[FetchResult]:
    """基础分页 ?pageno=N。"""
    page = int(task.extra.get("page", 1))
    if page > 1:
        await asyncio.sleep(1.0)
    url = f"{task.url}?pageno={page}" if page > 1 else task.url
    resp = await fetcher.fetch(url, headers=task.headers, referer=REFERER)
    return resp


# ---------------------------------------------------------------- s06 iframe
async def s06_solver(task: Task, fetcher: Fetcher) -> Optional[FetchResult]:
    """先抓外层页找 iframe src，再请求内页解析表格。"""
    page = await fetcher.fetch(task.url, headers=task.headers, referer=REFERER)
    iframe_src = ""
    if "<iframe" in page.text:
        from lxml import etree
        root = etree.HTML(page.text)
        nodes = root.xpath("//iframe/@src")
        iframe_src = nodes[0] if nodes else ""
    if not iframe_src:
        raise RuntimeError("s06 未找到 iframe")
    inner_url = iframe_src if iframe_src.startswith("http") else (
        "https://spiderbuf.cn" + iframe_src if iframe_src.startswith("/")
        else task.url.rsplit("/", 1)[0] + "/" + iframe_src)
    await _sleep()
    resp = await fetcher.fetch(inner_url, headers=task.headers, referer=task.url)
    return resp


# ---------------------------------------------------------------- e01 登录
async def e01_solver(task: Task, fetcher: Fetcher) -> Optional[FetchResult]:
    """POST admin/123456 登录（Session 维持 Cookie），再 GET /list。"""
    base = task.url
    await fetcher.fetch(base, headers=task.headers, referer=REFERER)
    await _sleep()
    await fetcher.fetch(base + "/login", method="POST",
                        data={"username": "admin", "password": "123456"},
                        headers=task.headers, referer=base)
    await _sleep()
    resp = await fetcher.fetch(base + "/list", headers=task.headers, referer=base)
    return resp


def build_solver_registry() -> Dict[str, Any]:
    """返回 solver 注册表（注入引擎 solver_registry）。"""
    return {
        "c01": c01_solver,
        "c03": c03_solver,
        "c06": c06_solver,
        "c07": c07_solver,
        "c10": c10_solver,
        "h05": h05_solver,
        "c08": c08_solver,
        "c09": c09_solver,
        "c11": c11_solver,
        "n03": n03_solver,
        "s04": s04_solver,
        "s06": s06_solver,
        "e01": e01_solver,
    }
