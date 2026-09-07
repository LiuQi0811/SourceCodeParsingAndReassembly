"""blob / MSE 视频抓取（可选后端，需要 Playwright）。

------------------------------------------------------------------------
为什么需要单独一个模块
------------------------------------------------------------------------
`blob:https://site.com/uuid-xxxx` 这种地址，服务端根本不存在。
它是浏览器调用 URL.createObjectURL() 在内存里生成的临时引用，
页面一关就失效，用 HTTP 去请求它必然失败。

但视频数据不是凭空来的——它是 JS 下载真实分片、再喂给浏览器的。
所以要抓 blob 视频，**不能追 blob: 这个 URL，要追它背后的数据**。

两条路：

  方案 A  拦截网络响应
          JS 下载分片时，Playwright 能在网络层看到每个请求，
          把 Content-Type 是音视频的响应存下来即可。
          适合：能拿到真实分片 URL 的场景（m3u8、mp4 直链、m4s 分片）

  方案 B  拦截 appendBuffer
          MSE 播放器最后都要调 SourceBuffer.appendBuffer() 把数据喂进去，
          Hook 这个方法，拿到的就是播放器实际用的字节流。
          适合：连分片 URL 都拿不到、或 URL 带签名时效的场景

  方案 B 更强，因为它是播放器"实际消费"的数据，天然按顺序、
  且已经包含初始化段。代价是拿到的是裸流，需要拼装。

------------------------------------------------------------------------
fMP4 拼装（关键，且比想象中简单）
------------------------------------------------------------------------
现代站点（B站、腾讯视频、YouTube）多用 fMP4 分片（.m4s）。
fMP4 的好处是：**init 段 + 分片按顺序直接拼起来就是合法 mp4**，
不需要 ffmpeg 转封装，cat 就行。已实测验证。

    cat init.mp4 seg_000.m4s seg_001.m4s ... > out.mp4   # 可直接播放

如果拦截到的是 TS 分片，则交给现有的 hls.py 处理。

------------------------------------------------------------------------
前置条件（缺一不可）
------------------------------------------------------------------------
1. pip install playwright && playwright install chromium
2. 视频必须真实播放起来——很多播放器滚动到视口才加载，或需要点播放
3. ffmpeg 可选：仅 TS 分片合并时需要，fMP4 不需要

DRM（Widevine / FairPlay / PlayReady）加密的内容抓不到，
这是浏览器安全架构层面的限制，且涉及法律风险，本模块不做。
"""

from __future__ import annotations

import base64
import os
import shutil
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import urlparse

# ---------------------------------------------------------------- 数据结构


@dataclass
class BlobConfig:
    """浏览器抓取配置。"""

    wait_seconds: float = 30.0      # 数据收集的超时时间
    idle_seconds: float = 3.0       # 连续多久没新数据就认为收完了
    click_selector: str = ""        # 需要点击才能播放时的选择器
    scroll_to_bottom: bool = True   # 先滚到底，触发懒加载
    auto_play: bool = True          # 自动对 <video> 调用 play()
    headless: bool = True
    proxy: Optional[str] = None
    user_agent: Optional[str] = None
    extra_wait_ms: int = 1500       # 页面加载后的固定等待


@dataclass
class BlobResult:
    url: str = ""
    path: str = ""              # 最终视频文件
    chunks: int = 0             # 拦截到的分片数
    size: int = 0
    method: str = ""            # append-buffer / network / 混合
    video_count: int = 0        # 页面上发现几个 video
    error: str = ""

    @property
    def ok(self) -> bool:
        return bool(self.path) and not self.error

    def to_dict(self) -> dict:
        return {
            "url": self.url, "path": self.path, "chunks": self.chunks,
            "size": self.size, "method": self.method,
            "video_count": self.video_count, "error": self.error,
        }


# ---------------------------------------------------------------- 注入脚本

# 在页面任何脚本执行前注入，Hook 住 appendBuffer。
# 注意两点：
#   1. 必须 data.slice(0) 复制一份——播放器会复用或释放传入的 buffer，
#      不复制的话取出来的可能是空的或被覆盖的数据
#   2. 不能 push 到外部数组再一次性读取，大视频会撑爆内存，
#      所以 Python 侧分块取，取完就地清空
HOOK_SCRIPT = """
(() => {
  window.__MH_CHUNKS__ = window.__MH_CHUNKS__ || [];
  window.__MH_BLOBS__ = window.__MH_BLOBS__ || [];

  // 不能只靠布尔守卫：add_init_script 在页面重定向、多 frame 等情况下
  // 可能跑到同一个 window 上第二次，布尔量一旦被重置就会包装叠加，
  // 结果是同一段数据被记录两次，拼出来的视频重复播放。
  // 所以再给被替换的函数打标记，形成双保险。
  const record = (data) => {
    try {
      if (data && data.byteLength > 0) {
        // slice(0) 是关键：播放器会复用或释放传入的 buffer，
        // 不复制一份的话，取出来的可能是空的、或被覆盖的数据
        window.__MH_CHUNKS__.push(data.slice(0));
      }
    } catch (e) {
      window.__MH_HOOK_ERROR__ = String(e);
    }
  };

  const wrap = (proto, name) => {
    if (typeof proto[name] !== 'function') return;
    const orig = proto[name];
    if (orig.__MH_WRAPPED__) return;   // 已包装过，绝不叠加
    const patched = function (data) {
      record(data);
      return orig.apply(this, arguments);
    };
    patched.__MH_WRAPPED__ = true;
    proto[name] = patched;
  };

  wrap(SourceBuffer.prototype, 'appendBuffer');
  // 部分播放器用的是异步版本
  wrap(SourceBuffer.prototype, 'appendBufferAsync');

  // 记录 blob: 地址，便于排查"页面上到底有几个 MSE 源"
  if (typeof URL !== 'undefined' && !URL.createObjectURL.__MH_WRAPPED__) {
    const origCreate = URL.createObjectURL;
    const patchedCreate = function (obj) {
      const url = origCreate.call(this, obj);
      try {
        if (typeof MediaSource !== 'undefined' && obj instanceof MediaSource) {
          window.__MH_BLOBS__.push(url);
        }
      } catch (e) {}
      return url;
    };
    patchedCreate.__MH_WRAPPED__ = true;
    URL.createObjectURL = patchedCreate;
  }

  window.__MH_HOOKED__ = true;
})();
"""

# 取第 i 块数据，转成 base64 返回。
# 一次只取一块，避免大视频一次性序列化导致页面卡死。
FETCH_CHUNK = """
(index) => {
  const chunks = window.__MH_CHUNKS__ || [];
  if (index >= chunks.length) return null;
  const buf = chunks[index];
  const bytes = new Uint8Array(buf);
  // 分块 btoa，避免 apply 参数过多导致栈溢出
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
"""

CLEAR_CHUNKS = "() => { window.__MH_CHUNKS__ = []; }"
COUNT_CHUNKS = "() => (window.__MH_CHUNKS__ || []).length"
VIDEO_INFO = """
() => Array.from(document.querySelectorAll('video')).map(v => ({
  src: v.currentSrc || v.src || '',
  blob: (v.currentSrc || v.src || '').startsWith('blob:'),
  duration: v.duration || 0,
  readyState: v.readyState,
}))
"""


# ---------------------------------------------------------------- 拼装

def is_mp4(data: bytes) -> bool:
    """判断一段数据是不是 MP4 容器（ftyp box 开头）。"""
    return len(data) >= 8 and data[4:8] in (b"ftyp", b"styp")


def is_ts(data: bytes) -> bool:
    """MPEG-TS 以 0x47 同步字节开头，且每 188 字节一个包。"""
    if len(data) < 188:
        return False
    return data[0] == 0x47 and data[188] == 0x47


def assemble(chunks: list[bytes], out_path: Path) -> tuple[str, str]:
    """把拦截到的分片拼成视频。

    :return: (实际写出的文件路径, 采用的方式)
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if not chunks:
        return "", ""

    # fMP4：init 段 + 分片按顺序拼接，直接就是合法 mp4
    if is_mp4(chunks[0]):
        out_path.write_bytes(b"".join(chunks))
        return str(out_path), "fmp4-concat"

    # TS：裸拼接也能播，但有 ffmpeg 的话转封装成 mp4 更通用
    if is_ts(chunks[0]):
        if shutil.which("ffmpeg"):
            raw = out_path.with_suffix(out_path.suffix + ".ts")
            raw.write_bytes(b"".join(chunks))
            cmd = ["ffmpeg", "-y", "-loglevel", "error",
                   "-i", str(raw), "-c", "copy",
                   "-movflags", "+faststart", str(out_path)]
            try:
                proc = subprocess.run(cmd, capture_output=True, timeout=600)
                if proc.returncode == 0 and out_path.exists() \
                        and out_path.stat().st_size > 0:
                    raw.unlink(missing_ok=True)
                    return str(out_path), "ts-remux"
            except (subprocess.SubprocessError, OSError):
                pass
            raw.unlink(missing_ok=True)
        ts_path = out_path.with_suffix(".ts")
        ts_path.write_bytes(b"".join(chunks))
        return str(ts_path), "ts-concat"

    # 认不出来，原样存下来，让用户自己判断
    blob_path = out_path.with_suffix(".bin")
    blob_path.write_bytes(b"".join(chunks))
    return str(blob_path), "raw"


# ---------------------------------------------------------------- 主类

class BlobHarvester:
    """用 Playwright 抓 blob / MSE 视频。"""

    def __init__(self, config: Optional[BlobConfig] = None,
                 on_event: Optional[Callable[[str, object], None]] = None):
        self.cfg = config or BlobConfig()
        self.on_event = on_event or (lambda *_: None)

    def _emit(self, event: str, payload=None) -> None:
        self.on_event(event, payload)

    # ---------- 页面侧收集 ----------

    def _collect_chunks(self, page) -> list[bytes]:
        """把页面里累积的分片逐块取回 Python 侧。"""
        chunks: list[bytes] = []
        total = page.evaluate(COUNT_CHUNKS)
        if not total:
            return chunks

        self._emit("collect_start", total)
        for i in range(total):
            encoded = page.evaluate(FETCH_CHUNK, i)
            if not encoded:
                continue
            chunks.append(base64.b64decode(encoded))
            self._emit("collect", {"index": i + 1, "total": total})

        # 取完清空，释放页面内存
        page.evaluate(CLEAR_CHUNKS)
        return chunks

    def _wait_for_data(self, page, deadline: float) -> int:
        """等到不再有新数据进来为止。"""
        last_count, stable_since = 0, time.time()
        while time.time() < deadline:
            count = page.evaluate(COUNT_CHUNKS)
            if count != last_count:
                last_count, stable_since = count, time.time()
                self._emit("waiting", count)
            elif count and (time.time() - stable_since) >= self.cfg.idle_seconds:
                break  # 连续 idle_seconds 秒没有新数据，认为收完了
            time.sleep(0.5)
        return page.evaluate(COUNT_CHUNKS)

    def _trigger_playback(self, page) -> None:
        """想尽办法让视频真正加载起来。"""
        if self.cfg.scroll_to_bottom:
            # 很多播放器滚动到视口才加载
            page.evaluate("""
                () => new Promise(resolve => {
                  let y = 0;
                  const step = () => {
                    y += window.innerHeight;
                    window.scrollTo(0, y);
                    if (y < document.body.scrollHeight) {
                      setTimeout(step, 200);
                    } else {
                      window.scrollTo(0, 0);
                      resolve();
                    }
                  };
                  step();
                })
            """)
            time.sleep(0.5)

        if self.cfg.click_selector:
            try:
                page.click(self.cfg.click_selector, timeout=5000)
                time.sleep(0.5)
            except Exception as exc:
                self._emit("warn", f"点击 {self.cfg.click_selector} 失败：{exc}")

        if self.cfg.auto_play:
            # 静音后 play() 才能绕过浏览器的自动播放限制
            page.evaluate("""
                () => document.querySelectorAll('video').forEach(v => {
                  v.muted = true;
                  const p = v.play();
                  if (p && p.catch) p.catch(() => {});
                })
            """)

    # ---------- 入口 ----------

    def harvest(self, url: str, dest_dir: str | Path,
                name: Optional[str] = None) -> BlobResult:
        """打开页面，等视频加载，把数据拼成文件。"""
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            return BlobResult(url=url, error=(
                "未安装 Playwright。请先执行：\n"
                "  pip install playwright\n"
                "  playwright install chromium"))

        dest_dir = Path(dest_dir)
        dest_dir.mkdir(parents=True, exist_ok=True)
        name = name or (Path(urlparse(url).path).stem or "video")
        result = BlobResult(url=url)

        with sync_playwright() as pw:
            launch_args = {
                "headless": self.cfg.headless,
                # 无头模式下部分站点会拒绝加载媒体，这个参数能改善
                "args": ["--autoplay-policy=no-user-gesture-required",
                         "--disable-blink-features=AutomationControlled"],
            }
            if self.cfg.proxy:
                launch_args["proxy"] = {"server": self.cfg.proxy}

            browser = pw.chromium.launch(**launch_args)
            context = browser.new_context(
                user_agent=self.cfg.user_agent,
                # 给足权限，避免媒体被策略拦下
                permissions=["autoplay"],
            )
            page = context.new_page()

            # 关键：必须在页面脚本执行前注入，晚了就 Hook 不到
            page.add_init_script(HOOK_SCRIPT)

            # 顺带记录网络层的媒体响应，作为兜底（方案 A）
            media_responses: list[tuple[str, bytes]] = []

            def on_response(response) -> None:
                try:
                    ctype = (response.headers or {}).get("content-type", "")
                    if not any(k in ctype.lower() for k in
                               ("video", "audio", "mpegurl", "mp4", "octet-stream")):
                        return
                    body = response.body()
                    if body and len(body) > 1024:
                        media_responses.append((response.url, body))
                        self._emit("network", {"url": response.url,
                                               "size": len(body)})
                except Exception:
                    # 页面跳转时 response 可能已失效，忽略即可
                    pass

            page.on("response", on_response)

            try:
                page.goto(url, wait_until="domcontentloaded", timeout=60000)
            except Exception as exc:
                result.error = f"打开页面失败：{exc}"
                browser.close()
                return result

            time.sleep(self.cfg.extra_wait_ms / 1000.0)

            infos = page.evaluate(VIDEO_INFO)
            result.video_count = len(infos)
            self._emit("videos", infos)
            blob_videos = [v for v in infos if v.get("blob")]

            self._trigger_playback(page)

            # 等数据进来
            deadline = time.time() + self.cfg.wait_seconds
            count = self._wait_for_data(page, deadline)

            chunks = self._collect_chunks(page) if count else []

            # MSE 没抓到时，退回方案 A：用网络层抓到的媒体响应
            if not chunks and media_responses:
                self._emit("fallback", len(media_responses))
                chunks = [body for _, body in media_responses]
                result.method = "network"
            elif chunks:
                result.method = "append-buffer"

            browser.close()

        if not chunks:
            result.error = (
                "没抓到任何视频数据。常见原因：\n"
                "  1. 需要点击播放按钮（用 --click 指定选择器）\n"
                "  2. 需要登录或 Cookie\n"
                "  3. 视频在 iframe 里（用 --browser-url 直接打开 iframe 地址）\n"
                "  4. 等待时间不够（加大 --wait）\n"
                "  5. 内容是 DRM 加密的，抓不到"
            )
            return result

        out = dest_dir / f"{name}.mp4"
        path, method = assemble(chunks, out)
        result.chunks = len(chunks)
        result.path = path
        result.size = Path(path).stat().st_size if path and Path(path).exists() else 0
        if result.method:
            result.method = f"{result.method}+{method}"
        else:
            result.method = method
        return result


def check_environment() -> dict:
    """检查 blob 抓取的前置条件是否满足。"""
    status = {"playwright": False, "chromium": False, "ffmpeg": False}

    try:
        import playwright  # noqa: F401
        status["playwright"] = True
    except ImportError:
        pass

    if status["playwright"]:
        # 直接查缓存目录，不启动 playwright——浏览器没装时，
        # 启动驱动会抛一堆连接异常，噪音比有用信息还多
        found = ""
        for base in (Path.home() / ".cache" / "ms-playwright",
                     Path(os.environ.get("PLAYWRIGHT_BROWSERS_PATH", ""))):
            if base and Path(base).exists():
                hits = sorted(Path(base).glob("chromium-*"))
                if hits:
                    found = str(hits[-1])
                    break
        status["chromium"] = bool(found)
        if found:
            status["chromium_path"] = found

    status["ffmpeg"] = shutil.which("ffmpeg") is not None
    return status
