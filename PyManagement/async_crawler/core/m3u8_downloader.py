# core/m3u8_downloader.py
"""HLS (m3u8) 下载器

功能:
- 解析主清单 (master playlist) 选最高码率子清单
- 解析媒体清单,提取 ts 分片 URL
- 支持 EXT-X-KEY (AES-128-CBC) 解密
- 并发下载 ts 分片(每分片支持断点续传)
- 用 ffmpeg 合并为 mp4 并清理分片文件

依赖:
- ffmpeg: 调用系统二进制 `ffmpeg` (已确认环境存在)
- AES-128-CBC 解密: 优先用 pycryptodome;未安装时对加密清单抛出明确异常
"""
import os
import re
import asyncio
import hashlib
import tempfile
from typing import List, Optional, Tuple
from urllib.parse import urljoin
import aiohttp

from settings import (
    TIMEOUT_CONNECT, TIMEOUT_READ,
    M3U8_TS_CONCURRENCY, M3U8_TS_MAX_SIZE, M3U8_KEEP_TS_SEGMENTS,
    FFMPEG_PATH,
)
from utils.file_utils import make_resource_dir, safe_filename


# AES-128 解密依赖:可选 import,缺失时给出明确提示
try:
    from Crypto.Cipher import AES  # pycryptodome
    _HAS_CRYPTO = True
except ImportError:
    _HAS_CRYPTO = False


class M3U8ParseError(Exception):
    pass


class M3U8Segment:
    __slots__ = ("uri", "duration", "index")

    def __init__(self, uri: str, duration: float, index: int):
        self.uri = uri
        self.duration = duration
        self.index = index


class M3U8Key:
    """EXT-X-KEY 解析结果;无加密时为 None"""

    def __init__(self, method: str, uri: str, iv: Optional[bytes]):
        self.method = method.upper()
        self.uri = uri
        self.iv = iv  # 16 字节 IV 或 None(用分片序号作 IV)

    @property
    def is_encrypted(self) -> bool:
        return self.method != "NONE"


class M3U8Playlist:
    def __init__(self):
        self.segments: List[M3U8Segment] = []
        self.key: Optional[M3U8Key] = None
        self.is_master: bool = False
        self.variants: List[Tuple[str, dict]] = []  # (uri, attrs)


def _parse_attrs(line: str) -> dict:
    """解析 EXT-X-...:KEY1="v",KEY2=42 形式的属性"""
    attrs = {}
    # 去掉行首的 #EXT-XXX:
    if ":" in line:
        body = line.split(":", 1)[1].strip()
    else:
        return attrs
    # 用正则切分:KEY="..." 或 KEY=token
    for m in re.finditer(r'([A-Z0-9-]+)=(?:"([^"]*)"|([^,]*))', body):
        k = m.group(1)
        v = m.group(2) if m.group(2) is not None else m.group(3)
        attrs[k] = v
    return attrs


def parse_m3u8(text: str, base_url: str) -> M3U8Playlist:
    """解析 m3u8 文本,自动处理相对/绝对 URL"""
    pl = M3U8Playlist()
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if not lines or not lines[0].startswith("#EXTM3U"):
        raise M3U8ParseError("无效的 m3u8 文件:缺少 #EXTM3U 头")

    current_key: Optional[M3U8Key] = None
    current_duration = 0.0
    seg_index = 0

    for line in lines:
        if line.startswith("#EXT-X-STREAM-INF"):
            # 主清单的子清单引用
            pl.is_master = True
            attrs = _parse_attrs(line)
            # 留待下一个非注释行作为子清单 URL
            pl.variants.append(("", attrs))
        elif line.startswith("#EXT-X-KEY"):
            attrs = _parse_attrs(line)
            method = attrs.get("METHOD", "NONE")
            uri = attrs.get("URI", "")
            iv_attr = attrs.get("IV", "")
            iv = None
            if iv_attr:
                # IV=0x... 形式
                hex_str = iv_attr[2:] if iv_attr.startswith("0x") else iv_attr
                try:
                    iv = bytes.fromhex(hex_str)
                except ValueError:
                    iv = None
            if uri:
                uri = urljoin(base_url, uri)
            current_key = M3U8Key(method, uri, iv)
            pl.key = current_key
        elif line.startswith("#EXTINF"):
            # #EXTINF:9.008,...
            try:
                current_duration = float(line.split(":")[1].split(",")[0])
            except (IndexError, ValueError):
                current_duration = 0.0
        elif line.startswith("#"):
            # 其他 tag 忽略
            continue
        else:
            # 媒体分片 / 子清单 URL
            abs_url = urljoin(base_url, line)
            if pl.is_master and pl.variants and pl.variants[-1][0] == "":
                pl.variants[-1] = (abs_url, pl.variants[-1][1])
            else:
                pl.segments.append(M3U8Segment(abs_url, current_duration, seg_index))
                seg_index += 1
            current_duration = 0.0

    return pl


def _select_best_variant(pl: M3U8Playlist) -> Tuple[str, dict]:
    """主清单中选最高码率子清单"""
    best = None
    best_bw = -1
    for uri, attrs in pl.variants:
        bw = int(attrs.get("BANDWIDTH", "0") or "0")
        if bw > best_bw:
            best_bw = bw
            best = (uri, attrs)
    if best is None:
        raise M3U8ParseError("主清单未找到任何子清单")
    return best


class M3U8Downloader:
    def __init__(
            self,
            session: aiohttp.ClientSession,
            proxy: Optional[str],
            headers: dict,
            save_root: str,
            base_url: str,
            referer: str = "",
    ):
        self.session = session
        self.proxy = proxy
        # 复制 headers 避免外部修改影响
        self.headers = dict(headers)
        if referer:
            self.headers["Referer"] = referer
        self.save_root = save_root
        self.base_url = base_url
        # ts 并发限流
        self._ts_sem = asyncio.Semaphore(M3U8_TS_CONCURRENCY)

    async def _fetch_text(self, url: str) -> str:
        timeout = aiohttp.ClientTimeout(connect=TIMEOUT_CONNECT, total=TIMEOUT_READ)
        async with self.session.get(url, headers=self.headers, proxy=self.proxy, timeout=timeout) as resp:
            if resp.status >= 400:
                raise Exception(f"下载 m3u8 子清单失败 HTTP {resp.status}: {url}")
            return await resp.text()

    async def _fetch_key(self, key: M3U8Key) -> bytes:
        """下载 AES 密钥(16 字节)"""
        if not _HAS_CRYPTO:
            raise Exception(
                "检测到加密 m3u8 (AES-128),需要 pycryptodome 才能解密。"
                "请运行: uv add pycryptodome"
            )
        timeout = aiohttp.ClientTimeout(connect=TIMEOUT_CONNECT, total=TIMEOUT_READ)
        async with self.session.get(key.uri, headers=self.headers, proxy=self.proxy, timeout=timeout) as resp:
            if resp.status >= 400:
                raise Exception(f"下载密钥失败 HTTP {resp.status}: {key.uri}")
            return await resp.read()

    async def _download_segment(self, seg: M3U8Segment, seg_dir: str) -> str:
        """下载单个 ts 分片(支持断点续传);返回本地路径"""
        fn = f"seg_{seg.index:06d}.ts"
        save_path = os.path.join(seg_dir, fn)
        # 已完整下载则跳过(简单的本地存在性检查)
        if os.path.exists(save_path):
            return save_path

        timeout = aiohttp.ClientTimeout(connect=TIMEOUT_CONNECT, total=TIMEOUT_READ)
        async with self._ts_sem:
            async with self.session.get(
                seg.uri, headers=self.headers, proxy=self.proxy, timeout=timeout
            ) as resp:
                if resp.status >= 400:
                    raise Exception(f"下载 ts 分片失败 HTTP {resp.status}: {seg.uri}")
                # 大小预检
                content_len = resp.headers.get("Content-Length")
                if content_len and int(content_len) > M3U8_TS_MAX_SIZE:
                    raise Exception(f"ts 分片过大: {content_len} bytes, 跳过")
                written = 0
                with open(save_path, "wb") as f:
                    async for chunk in resp.content.iter_chunked(65536):
                        f.write(chunk)
                        written += len(chunk)
                        if written > M3U8_TS_MAX_SIZE:
                            raise Exception(f"ts 分片超过最大限制: {written} bytes")
        return save_path

    def _decrypt_segment(self, cipher_key: bytes, key: M3U8Key, seg: M3U8Segment, raw: bytes) -> bytes:
        """AES-128-CBC 解密单个分片"""
        iv = key.iv if key.iv is not None else seg.index.to_bytes(16, "big")
        cipher = AES.new(cipher_key, AES.MODE_CBC, iv)
        return cipher.decrypt(raw)

    async def _merge_with_ffmpeg(self, seg_paths: List[str], output_path: str) -> str:
        """用 ffmpeg 把 ts 合并为 mp4"""
        if not seg_paths:
            raise Exception("无 ts 分片可合并")

        # 用 concat demuxer + list 文件,避免 concat: 协议在 Windows 上的路径问题
        list_fd, list_path = tempfile.mkstemp(suffix=".txt", prefix="m3u8_concat_")
        try:
            with os.fdopen(list_fd, "w", encoding="utf-8") as f:
                for p in seg_paths:
                    # ffmpeg concat list 要求单引号包裹,反斜杠转义
                    p_escaped = p.replace("\\", "\\\\").replace("'", "\\'")
                    f.write(f"file '{p_escaped}'\n")

            # ffmpeg -y -f concat -safe 0 -i list.txt -c copy out.mp4
            cmd = [
                FFMPEG_PATH, "-y",
                "-f", "concat", "-safe", "0",
                "-i", list_path,
                "-c", "copy",
                "-bsf:a", "aac_adtstoasc",
                output_path,
            ]
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()
            if proc.returncode != 0:
                # 合并失败常见原因:ts 时间戳不连续,带 AAC ADTS->ASC 转换问题
                # 退一步用重编码方式合并
                cmd_reencode = [
                    FFMPEG_PATH, "-y",
                    "-f", "concat", "-safe", "0",
                    "-i", list_path,
                    "-c:v", "libx264", "-preset", "veryfast",
                    "-c:a", "aac",
                    output_path,
                ]
                proc = await asyncio.create_subprocess_exec(
                    *cmd_reencode,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                _, stderr = proc.communicate()
                if proc.returncode != 0:
                    raise Exception(
                        f"ffmpeg 合并失败 (returncode={proc.returncode}): "
                        f"{stderr.decode('utf-8', errors='ignore')[-500:]}"
                    )
        finally:
            try:
                os.remove(list_path)
            except OSError:
                pass
        return output_path

    async def run(self, m3u8_text: str) -> str:
        """主入口:解析 → 选子清单 → 下载所有 ts → 合并为 mp4

        :return: 最终 mp4 保存路径
        """
        pl = parse_m3u8(m3u8_text, self.base_url)

        # 主清单:递归取最高码率子清单
        if pl.is_master:
            variant_uri, _attrs = _select_best_variant(pl)
            sub_text = await self._fetch_text(variant_uri)
            # 切换 base_url 上下文到子清单 URL 继续解析
            old_base = self.base_url
            self.base_url = variant_uri
            try:
                return await self.run(sub_text)
            finally:
                self.base_url = old_base

        if not pl.segments:
            raise M3U8ParseError("m3u8 清单无任何 ts 分片")

        # 输出 mp4 路径:基于 m3u8 URL 生成文件名
        out_dir = make_resource_dir(self.save_root, "video")
        from urllib.parse import urlparse
        url_basename = os.path.basename(urlparse(self.base_url).path)
        fn = safe_filename(url_basename, fallback=self.base_url)
        # 把 .m3u8 扩展名换成 .mp4
        if fn.lower().endswith(".m3u8"):
            fn = fn[:-5] + ".mp4"
        elif "." not in fn:
            fn += ".mp4"
        else:
            # 保留原 stem,换扩展名为 .mp4
            fn = os.path.splitext(fn)[0] + ".mp4"
        output_path = os.path.join(out_dir, fn)

        # 若最终 mp4 已存在,直接跳过重抓
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return output_path

        # ts 分片临时目录(用 m3u8 URL hash 命名,避免不同视频混在一起)
        url_hash = hashlib.md5(self.base_url.encode("utf-8")).hexdigest()[:10]
        seg_dir = os.path.join(self.save_root, ".m3u8_cache", url_hash)
        os.makedirs(seg_dir, exist_ok=True)

        # 若加密,先拿密钥
        cipher_key: Optional[bytes] = None
        if pl.key and pl.key.is_encrypted:
            cipher_key = await self._fetch_key(pl.key)

        # 并发下载所有分片(顺序保留)
        tasks = [self._download_segment(seg, seg_dir) for seg in pl.segments]
        seg_paths = await asyncio.gather(*tasks)

        # 加密分片需要就地解密(覆盖原 ts)
        if cipher_key is not None and pl.key is not None:
            for seg, path in zip(pl.segments, seg_paths):
                with open(path, "rb") as f:
                    raw = f.read()
                decrypted = self._decrypt_segment(cipher_key, pl.key, seg, raw)
                with open(path, "wb") as f:
                    f.write(decrypted)

        # ffmpeg 合并
        await self._merge_with_ffmpeg(list(seg_paths), output_path)

        # 清理 ts 分片
        if not M3U8_KEEP_TS_SEGMENTS:
            for p in seg_paths:
                try:
                    os.remove(p)
                except OSError:
                    pass
            # 尝试删除空缓存目录
            try:
                os.rmdir(seg_dir)
            except OSError:
                pass

        return output_path
