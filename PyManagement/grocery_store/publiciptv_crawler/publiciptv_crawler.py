#!/usr/bin/env python3
"""
PublicIPTV.com 全站爬虫
=======================
功能：
  1. 抓取全部 231 个国家列表
  2. 逐国逐页抓取所有频道列表（自动分页）
  3. 逐个频道抓取详情页，提取所有 m3u8 流地址（含 status_code、source、redirect 等）
  4. 提取频道元数据（名称、国家、分类、logo、更新时间、描述、网站、所属网络等）
  5. 支持断点续爬、并发请求、失败重试、速率限制、页面缓存
  6. 输出 JSON 完整数据 + M3U 播放列表（全量/最佳/分国家/分分类）
  7. 生成统计摘要

逆向分析结论（2026-09-11）：
  - 框架：Next.js App Router + Turbopack（React Server Components / RSC Flight 协议）
  - 渲染：SSR，所有数据在 HTML 中以 RSC flight 数据格式明文嵌入
  - 加密：❌ 无加密、无 token、无签名、无 JS 解密、无 API 鉴权
  - 唯一需要"逆向"的点：RSC flight 二进制格式中的长字符串使用 T439 (HashedString) 类型，
    通过十六进制/十进制 ID 引用（如 "address":"$15"），需要从 RSC 流中构建字符串引用表
    进行解析。长 URL（含 JWT token）可能被 RSC 分块传输切割到多个 <script> 标签之间，
    需要先拼接所有 chunk 再解析。
  - 流数据位置：/channels/{id} 页面中的 "streams":[{"channel_id":...,"address":...,...}]
  - 流字段：address (m3u8 URL), checking_count, status_code (200=可用), address_redirect, source
  - 分页：/countries/{code}?page=N，每页约36个频道
  - 反爬：仅 Cloudflare 基础防护，标准 UA + 合理延迟即可稳定抓取
  - 规模：231 个国家/地区，估计总频道数 ~20000+

用法：
  python3 publiciptv_crawler.py                         # 全量抓取全站
  python3 publiciptv_crawler.py --country us            # 只抓美国
  python3 publiciptv_crawler.py --country us --pages 3  # 美国前3页（测试用）
  python3 publiciptv_crawler.py --concurrency 5         # 5并发加速
  python3 publiciptv_crawler.py --resume                # 断点续爬
  python3 publiciptv_crawler.py --delay 1.0             # 请求间隔1秒（更保守）
  python3 publiciptv_crawler.py --no-cache              # 不使用本地缓存
"""

import argparse
import json
import re
import time
import logging
import html as html_module
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Set

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

BASE_URL = "https://publiciptv.com"
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}

OUTPUT_DIR = Path(__file__).parent / "output"
CACHE_DIR = Path(__file__).parent / "cache"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("publiciptv")


# ---------------------------------------------------------------------------
# HTTP 会话
# ---------------------------------------------------------------------------

def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(DEFAULT_HEADERS)
    retry = Retry(
        total=5,
        backoff_factor=1.5,
        status_forcelist=[429, 500, 502, 503, 504, 520, 522, 524],
        allowed_methods=["GET"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=20, pool_maxsize=20)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    return s


def fetch_html(session: requests.Session, url: str, cache_path: Optional[Path] = None) -> Optional[str]:
    if cache_path and cache_path.exists():
        return cache_path.read_text(encoding="utf-8", errors="replace")
    try:
        time.sleep(0.05)
        resp = session.get(url, timeout=30, allow_redirects=True)
        if resp.status_code != 200:
            log.warning(f"HTTP {resp.status_code} for {url}")
            return None
        html_text = resp.text
        if cache_path:
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_text(html_text, encoding="utf-8")
        return html_text
    except requests.exceptions.RequestException as e:
        log.warning(f"Request failed for {url}: {e}")
        return None


# ---------------------------------------------------------------------------
# RSC Flight 协议解析（核心逆向部分）
# ---------------------------------------------------------------------------

def js_unescape(s: str) -> str:
    """解码 JavaScript 字符串中的转义序列"""
    s = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), s)
    s = s.replace('\\"', '"').replace('\\/', '/').replace('\\\\', '\\')
    s = s.replace('\\n', '\n').replace('\\t', '\t').replace('\\r', '\r')
    s = s.replace('\\b', '\b').replace('\\f', '\f')
    return s


def parse_rsc_flight(html: str) -> str:
    """
    从 Next.js App Router 的 HTML 中提取并拼接完整的 RSC flight 数据流。
    
    数据通过多个 self.__next_f.push([chunk_index,"data"]) 调用注入，
    长字符串可能被切割跨多个 chunk，需要先拼接再解析。
    """
    chunks = re.findall(r'self\.__next_f\.push\(\[\d+,"(.*?)"\]\)', html, re.DOTALL)
    return js_unescape("".join(chunks))


def build_rsc_string_table(rsc_text: str) -> Dict[str, str]:
    """
    解析 RSC flight 中的 T439 (HashedString) 字符串定义，构建引用表。
    
    RSC 中长字符串不直接内联，而是定义为:
        <id>:T439,<string_value>
    然后通过 "$<id>" 引用。ID 可以是十进制或十六进制（如 1a = 26）。
    
    注意：长字符串值（如含JWT的URL）可能跨越多个push chunk，而且连续定义之间
    可能没有换行分隔符（JWT末尾直接接下一个ID），所以不能依赖行边界。
    """
    # 找到所有 T439 标记位置
    markers = list(re.finditer(r'([0-9a-f]{1,4}):T439,', rsc_text))
    table: Dict[str, str] = {}

    for i, m in enumerate(markers):
        sid = m.group(1)
        val_start = m.end()
        val_end = markers[i + 1].start() if i + 1 < len(markers) else len(rsc_text)
        val = rsc_text[val_start:val_end].rstrip('\n').rstrip(',').rstrip()

        # ID 转换（1a -> 26 十进制）
        try:
            int_id = int(sid, 16) if any(c in 'abcdef' for c in sid) else int(sid)
        except ValueError:
            int_id = sid

        table[str(int_id)] = val
        table[sid] = val  # 保留十六进制key以防引用混用

    return table


def resolve_rsc_ref(ref: str, string_table: Dict[str, str]) -> str:
    """解析 RSC 引用 ($15, $1a 等)"""
    if ref == "null" or ref is None:
        return ""
    ref = ref.strip('"')
    if ref.startswith("$"):
        rid = ref[1:]
        # 尝试十进制 key，再尝试十六进制
        if rid in string_table:
            return string_table[rid]
        try:
            hex_key = str(int(rid, 16))
            if hex_key in string_table:
                return string_table[hex_key]
        except ValueError:
            pass
        return ref  # 无法解析时返回原始引用
    return ref


# ---------------------------------------------------------------------------
# 数据提取
# ---------------------------------------------------------------------------

def extract_meta(html: str, name: str) -> str:
    m = re.search(
        rf'<meta\s+(?:name|property)="{re.escape(name)}"\s+content="([^"]*)"', html
    )
    return html_module.unescape(m.group(1)) if m else ""


def extract_title(html: str) -> str:
    m = re.search(r"<title>([^<]+)</title>", html)
    if m:
        return html_module.unescape(m.group(1)).split("|")[0].strip()
    return ""


def extract_countries(html: str) -> List[Dict]:
    """从 /countries 页面提取所有国家列表"""
    countries = []
    seen = set()
    for code in sorted(set(re.findall(r'href="/countries/([a-z]{2})(?:\?[^"]*)?"', html))):
        if len(code) == 2 and code not in seen:
            seen.add(code)
            countries.append({"code": code, "name": code.upper(), "url": f"{BASE_URL}/countries/{code}"})
    return countries


def extract_channel_ids(html: str) -> List[str]:
    return sorted(set(re.findall(r'href="/channels/([a-z0-9][a-z0-9-]*[a-z0-9])"', html)))


def extract_max_page(html: str) -> int:
    pages = re.findall(r'[?&]page=(\d+)', html)
    return max((int(p) for p in pages), default=1)


def extract_channel_detail(html: str, channel_id: str) -> Dict:
    """
    从频道详情页提取完整数据，包括：
    - 基础元数据（名称、logo、描述、分类、国家等）
    - 完整的 channel 对象（含 network, website, languages 等扩展字段）
    - 所有流地址（解析 RSC T439 引用）
    """
    rsc = parse_rsc_flight(html)
    str_table = build_rsc_string_table(rsc)

    result = {
        "id": channel_id,
        "name": extract_title(html),
        "country": "",
        "categories": [],
        "logo": extract_meta(html, "og:image",),
        "updated_at": extract_meta(html, "updated_at"),
        "description": extract_meta(html, "description"),
        "network": "",
        "website": "",
        "languages": "",
        "alt_names": "",
        "url": f"{BASE_URL}/channels/{channel_id}",
        "streams": [],
    }

    # 从 keywords 提取分类
    kw = extract_meta(html, "keywords")
    if kw:
        parts = [k.strip() for k in kw.split(",") if k.strip()]
        skip = {"IPTV", "live TV", "streaming", "online TV", ""}
        result["categories"] = [p for p in parts[1:] if p not in skip]

    # 从描述提取国家: "Watch XXX - cat from CC."
    desc_country = re.search(r"from\s+([A-Z]{2,3})\.", result["description"])
    if desc_country:
        result["country"] = desc_country.group(1)
    else:
        cm = re.search(r'href="/countries/([a-z]{2})"', html)
        if cm:
            result["country"] = cm.group(1).upper()

    # 从 RSC 中提取完整的 channel 对象（包含扩展字段）
    # 格式: "channel":{"channel_id":"xxx","id":"...","name":"...","network":"...",...}
    ch_match = re.search(
        r'"channel":\{"channel_id":"[^"]+","id":"([^"]*)","name":"([^"]*)","alt_names":"([^"]*)","network":"([^"]*)","owners":"([^"]*)","country":"([^"]*)".*?"website":"([^"]*)"',
        rsc,
    )
    if ch_match:
        ext_id, name, alt, network, owners, country, website = ch_match.groups()
        if name:
            result["name"] = html_module.unescape(name)
        if alt:
            result["alt_names"] = html_module.unescape(alt)
        if network:
            result["network"] = html_module.unescape(network)
        if website:
            result["website"] = website
        if country:
            result["country"] = country

    # 提取 streams JSON 数组 - 需要先找到数组边界
    streams_key = '"streams":['
    streams_pos = rsc.find(streams_key)
    streams: List[Dict] = []

    if streams_pos >= 0:
        arr_start = streams_pos + len(streams_key)
        # 扫描到匹配的 ] 结束
        depth = 1
        pos = arr_start
        in_str = False
        while pos < len(rsc) and depth > 0:
            ch = rsc[pos]
            if ch == "\\" and pos + 1 < len(rsc):
                pos += 2
                continue
            if ch == '"':
                in_str = not in_str
            elif not in_str:
                if ch == "[":
                    depth += 1
                elif ch == "]":
                    depth -= 1
            pos += 1

        if depth == 0:
            raw_arr = "[" + rsc[arr_start:pos - 1] + "]"
            # 用非正则方式解析 stream 对象
            # 逐个提取 { ... } 对象
            obj_pattern = re.compile(
                r'\{"channel_id":"([^"]*)","address":"([^"]+)","checking_count":"([^"]*)","status_code":"([^"]*)","address_redirect":([^,]+),"source":"([^"]*)"\}'
            )
            seen_urls: Set[str] = set()
            for om in obj_pattern.finditer(raw_arr):
                _cid, addr_ref, check, status, redirect_ref, source = om.groups()
                url = resolve_rsc_ref(addr_ref, str_table)
                redirect = resolve_rsc_ref(redirect_ref, str_table) or None
                if not url or url in seen_urls or url.startswith("$"):
                    continue
                seen_urls.add(url)
                try:
                    sc = int(status)
                except ValueError:
                    sc = None
                streams.append({
                    "url": url,
                    "status_code": sc,
                    "source": source,
                    "checking_count": int(check) if check.isdigit() else None,
                    "redirect": redirect if redirect and redirect != url else None,
                    "is_working": sc == 200 if sc is not None else None,
                })

    # 兜底：直接从 RSC 文本正则提取 m3u8 URL（防止JSON边界解析遗漏）
    m3u8_urls = set(re.findall(r'https?://[^\s"<>\\]+\.m3u8[^\s"<>\\]*', rsc))
    seen_urls = {s["url"] for s in streams}
    for url in m3u8_urls:
        url = url.rstrip("\\").rstrip('"').rstrip("'").rstrip(",")
        url = url.replace("\\/", "/").replace('\\"', "")
        if url and url not in seen_urls and not url.startswith("$") and len(url) > 20:
            streams.append({
                "url": url,
                "status_code": None,
                "source": "rsc_fallback",
                "checking_count": None,
                "redirect": None,
                "is_working": None,
            })

    result["streams"] = streams
    result["stream_count"] = len(streams)
    result["working_stream_count"] = sum(1 for s in streams if s.get("is_working"))

    # HTML entity 解码
    result["name"] = html_module.unescape(result["name"])
    result["description"] = html_module.unescape(result["description"])

    return result


# ---------------------------------------------------------------------------
# 爬虫主类
# ---------------------------------------------------------------------------

class PublicIPTVCrawler:
    def __init__(
        self,
        concurrency: int = 3,
        delay: float = 0.4,
        country_filter: Optional[str] = None,
        max_pages_per_country: Optional[int] = None,
        resume: bool = False,
        use_cache: bool = True,
    ):
        self.session = make_session()
        self.concurrency = concurrency
        self.delay = delay
        self.country_filter = country_filter.upper() if country_filter else None
        self.max_pages = max_pages_per_country
        self.resume = resume
        self.use_cache = use_cache

        self.channels: Dict[str, Dict] = {}
        self.countries: List[Dict] = []
        self.failed: Set[str] = set()

        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        if use_cache:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)

        self.channels_file = OUTPUT_DIR / "channels.json"
        self.progress_file = OUTPUT_DIR / "_progress.json"

        if resume and self.channels_file.exists():
            try:
                with open(self.channels_file, "r", encoding="utf-8") as f:
                    for ch in json.load(f):
                        self.channels[ch["id"]] = ch
                log.info(f"断点续爬：已加载 {len(self.channels)} 个频道")
            except Exception as e:
                log.warning(f"加载已有数据失败: {e}")

    def _cache(self, name: str) -> Optional[Path]:
        return CACHE_DIR / f"{name}.html" if self.use_cache else None

    def save(self):
        data = sorted(self.channels.values(), key=lambda x: (x.get("country", ""), x.get("name", "")))
        with open(self.channels_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        progress = {
            "saved_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "total_channels": len(self.channels),
            "total_streams": sum(c.get("stream_count", 0) for c in self.channels.values()),
            "working_streams": sum(c.get("working_stream_count", 0) for c in self.channels.values()),
            "failed": len(self.failed),
        }
        with open(self.progress_file, "w", encoding="utf-8") as f:
            json.dump(progress, f, ensure_ascii=False, indent=2)

    def get_countries(self) -> List[Dict]:
        log.info("正在获取国家列表...")
        html = fetch_html(self.session, f"{BASE_URL}/countries", self._cache("countries"))
        if not html:
            log.error("无法获取国家列表")
            return []
        countries = extract_countries(html)
        log.info(f"共发现 {len(countries)} 个国家/地区")
        self.countries = countries
        return countries

    def crawl_country_ids(self, code: str) -> List[str]:
        ids: List[str] = []
        page = 1
        while True:
            if self.max_pages and page > self.max_pages:
                break
            url = f"{BASE_URL}/countries/{code.lower()}?page={page}"
            html = fetch_html(self.session, url, self._cache(f"ct_{code}_p{page}"))
            if not html:
                log.warning(f"  [{code}] 第{page}页获取失败")
                break
            page_ids = extract_channel_ids(html)
            new_ids = [c for c in page_ids if c not in ids]
            ids.extend(new_ids)
            log.info(f"  [{code}] 第{page}页: {len(new_ids)} 个新频道 (累计 {len(ids)})")
            if page >= extract_max_page(html) or not new_ids:
                break
            page += 1
            time.sleep(self.delay)
        return ids

    def crawl_channel(self, cid: str) -> Optional[Dict]:
        if cid in self.channels and self.resume:
            return self.channels[cid]
        html = fetch_html(self.session, f"{BASE_URL}/channels/{cid}", self._cache(f"ch_{cid}"))
        if not html:
            self.failed.add(cid)
            return None
        time.sleep(self.delay)
        try:
            return extract_channel_detail(html, cid)
        except Exception as e:
            log.warning(f"解析频道 {cid} 失败: {e}")
            self.failed.add(cid)
            return None

    def run(self):
        log.info("=" * 60)
        log.info("  PublicIPTV.com 全站爬虫启动")
        log.info(f"  并发: {self.concurrency}  请求间隔: {self.delay}s")
        if self.country_filter:
            log.info(f"  国家过滤: {self.country_filter}")
        if self.max_pages:
            log.info(f"  每国最大页数: {self.max_pages}")
        log.info("=" * 60)

        countries = self.get_countries()
        if self.country_filter:
            countries = [c for c in countries if c["code"].upper() == self.country_filter]
            if not countries:
                log.error(f"未找到国家: {self.country_filter}")
                return

        # Phase 1: 收集频道ID
        log.info(f"\n--- 阶段1: 收集 {len(countries)} 国频道列表 ---")
        all_ids: Set[str] = set()
        for i, c in enumerate(countries, 1):
            log.info(f"[{i}/{len(countries)}] {c['name']} ({c['code']})")
            ids = self.crawl_country_ids(c["code"])
            new = sum(1 for x in ids if x not in all_ids)
            all_ids.update(ids)
            log.info(f"  -> {len(ids)} 个频道 (新增 {new} 唯一)")
            if i % 10 == 0:
                self.save()

        log.info(f"\n共发现 {len(all_ids)} 个唯一频道")

        # Phase 2: 并发抓取详情
        log.info(f"\n--- 阶段2: 抓取频道详情与流地址 ---")
        todo = [cid for cid in all_ids if cid not in self.channels]
        log.info(f"待抓取: {len(todo)} (已有: {len(self.channels)})")

        done = 0
        with ThreadPoolExecutor(max_workers=self.concurrency) as pool:
            futures = {pool.submit(self.crawl_channel, cid): cid for cid in todo}
            for fut in as_completed(futures):
                cid = futures[fut]
                try:
                    detail = fut.result()
                    if detail:
                        self.channels[cid] = detail
                        wc = detail.get("working_stream_count", 0)
                        tc = detail.get("stream_count", 0)
                        log.info(f"  [{done+1}/{len(todo)}] {detail['name']} ({cid}): {wc}/{tc} 可用")
                    else:
                        log.warning(f"  [{done+1}/{len(todo)}] {cid}: 失败")
                except Exception as e:
                    self.failed.add(cid)
                    log.warning(f"  [{done+1}/{len(todo)}] {cid}: 异常 {e}")
                done += 1
                if done % 50 == 0:
                    self.save()
                    log.info(f"  --- 进度已保存: {done}/{len(todo)} ---")

        self.save()
        self.generate_m3u()
        self.generate_summary()

        ts = sum(c.get("stream_count", 0) for c in self.channels.values())
        tw = sum(c.get("working_stream_count", 0) for c in self.channels.values())
        log.info("\n" + "=" * 60)
        log.info("  抓取完成!")
        log.info(f"  频道总数: {len(self.channels)}")
        log.info(f"  流地址总数: {ts} (可用: {tw})")
        log.info(f"  失败: {len(self.failed)}")
        log.info(f"  输出: {OUTPUT_DIR}")
        log.info("=" * 60)

    def generate_m3u(self):
        log.info("生成 M3U 播放列表...")
        chs = sorted(self.channels.values(), key=lambda x: (x.get("country", ""), x.get("name", "")))

        def write_m3u(path: Path, channels: List[Dict], all_streams: bool = False):
            with open(path, "w", encoding="utf-8") as f:
                f.write("#EXTM3U\n")
                for ch in channels:
                    working = [s for s in ch["streams"] if s.get("is_working")]
                    if not working:
                        continue
                    stream_list = working if all_streams else [working[0]]
                    for idx, s in enumerate(stream_list):
                        name = ch["name"]
                        if all_streams and len(working) > 1:
                            name = f"{name} (源{idx+1})"
                        logo = ch.get("logo", "")
                        group = ch.get("country", "Other")
                        f.write(
                            f'#EXTINF:-1 tvg-id="{ch["id"]}" tvg-name="{name}" '
                            f'tvg-logo="{logo}" group-title="{group}",{name}\n'
                        )
                        f.write(f'{s["url"]}\n')

        write_m3u(OUTPUT_DIR / "publiciptv_all_streams.m3u", chs, all_streams=True)
        write_m3u(OUTPUT_DIR / "publiciptv_best.m3u", chs, all_streams=False)

        cdir = OUTPUT_DIR / "m3u_by_country"
        cdir.mkdir(exist_ok=True)
        by_c: Dict[str, List] = {}
        for ch in chs:
            by_c.setdefault(ch.get("country", "UNKNOWN"), []).append(ch)
        for code, cch in by_c.items():
            write_m3u(cdir / f"{code.lower()}.m3u", cch)

        catdir = OUTPUT_DIR / "m3u_by_category"
        catdir.mkdir(exist_ok=True)
        by_cat: Dict[str, List] = {}
        for ch in chs:
            for cat in ch.get("categories", []):
                if cat:
                    by_cat.setdefault(cat, []).append(ch)
        for cat, cch in by_cat.items():
            safe = re.sub(r"[^\w-]", "_", cat.lower())
            write_m3u(catdir / f"{safe}.m3u", cch)

        log.info(f"  全量M3U + 最佳M3U + {len(by_c)}个国家 + {len(by_cat)}个分类")

    def generate_summary(self):
        chs = list(self.channels.values())
        by_c: Dict[str, int] = {}
        by_cat: Dict[str, int] = {}
        ts = tw = 0
        for ch in chs:
            by_c[ch.get("country", "?")] = by_c.get(ch.get("country", "?"), 0) + 1
            for c in ch.get("categories", []):
                if c:
                    by_cat[c] = by_cat.get(c, 0) + 1
            ts += ch.get("stream_count", 0)
            tw += ch.get("working_stream_count", 0)
        summary = {
            "crawl_time": time.strftime("%Y-%m-%d %H:%M:%S"),
            "source": BASE_URL,
            "reverse_engineering": (
                "Next.js App Router RSC Flight协议。流地址明文嵌入SSR HTML，"
                "使用T439 HashedString引用（$id），无加密/无token/无签名。"
                "已完整解析RSC字符串表，包括跨chunk分割的长URL。"
            ),
            "total_channels": len(chs),
            "total_streams": ts,
            "working_streams": tw,
            "success_rate": f"{tw/ts*100:.1f}%" if ts else "N/A",
            "failed": len(self.failed),
            "top_countries": dict(sorted(by_c.items(), key=lambda x: -x[1])[:30]),
            "categories": dict(sorted(by_cat.items(), key=lambda x: -x[1])),
        }
        with open(OUTPUT_DIR / "summary.json", "w", encoding="utf-8") as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        log.info(f"频道: {len(chs)}, 流: {ts} (可用 {tw}, {summary['success_rate']})")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="PublicIPTV.com 全站爬虫")
    parser.add_argument("--country", "-c", help="指定国家代码 (如 us, cn, jp, uk)")
    parser.add_argument("--pages", "-p", type=int, help="每国最大页数（测试用）")
    parser.add_argument("--concurrency", "-t", type=int, default=3, help="并发数(默认3)")
    parser.add_argument("--delay", "-d", type=float, default=0.4, help="请求间隔秒(默认0.4)")
    parser.add_argument("--resume", "-r", action="store_true", help="断点续爬")
    parser.add_argument("--no-cache", action="store_true", help="禁用缓存")
    args = parser.parse_args()

    crawler = PublicIPTVCrawler(
        concurrency=args.concurrency,
        delay=args.delay,
        country_filter=args.country,
        max_pages_per_country=args.pages,
        resume=args.resume,
        use_cache=not args.no_cache,
    )
    crawler.run()


if __name__ == "__main__":
    main()
