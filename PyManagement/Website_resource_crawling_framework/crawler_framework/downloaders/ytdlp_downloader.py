"""
yt-dlp 下载器封装
用于抓取强反爬/短视频平台（抖音/快手/B站/YouTube 等）
yt-dlp 已逆向 1000+ 站点，自动处理签名、分片、合并
"""
import asyncio
import os
from typing import Any, Callable, Dict, Optional


class YtDlpDownloader:
    """yt-dlp 异步封装：同步库跑在 to_thread 里"""

    SUPPORTED_DOMAINS = [
        "douyin.com", "kuaishou.com", "bilibili.com", "b23.tv",
        "youtube.com", "youtu.be", "xiaohongshu.com", "xhslink.com",
        "weibo.com", "weibo.cn", "tiktok.com", "v.douyin.com",
        "ixigua.com", "pearvideo.com",
    ]

    @classmethod
    def match(cls, url: str) -> bool:
        """判断 URL 是否属于 yt-dlp 支持的站点"""
        if not url:
            return False
        return any(d in url for d in cls.SUPPORTED_DOMAINS)

    @staticmethod
    def _build_opts(
        output_dir: str,
        on_progress: Optional[Callable] = None,
        format_id: str = "",
        audio_only: bool = False,
        write_subs: bool = False,
    ) -> Dict[str, Any]:
        os.makedirs(output_dir, exist_ok=True)
        if audio_only:
            fmt = "bestaudio"
        elif format_id:
            fmt = f"{format_id}/best"
        else:
            fmt = "best[ext=mp4]/best"
        opts: Dict[str, Any] = {
            "outtmpl": os.path.join(output_dir, "%(title).80s [%(id)s].%(ext)s"),
            "format": fmt,
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "overwrites": True,
        }
        if write_subs:
            opts["writesubtitles"] = True
            opts["writeautomaticsub"] = True
            opts["subtitleslangs"] = ["zh", "zh-CN", "en"]
        import os as _os
        cf = "cookies/yt-dlp.txt"
        if _os.path.exists(cf):
            opts["cookiefile"] = cf
        if on_progress:
            def hook(d: Dict[str, Any]) -> None:
                status = d.get("status")
                if status == "downloading":
                    total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                    done = d.get("downloaded_bytes") or 0
                    on_progress("downloading", done, total)
                elif status == "finished":
                    on_progress("finished", d.get("filename", ""), 0)
            opts["progress_hooks"] = [hook]
        return opts

    @classmethod
    async def download(
        cls,
        url: str,
        output_dir: str = "downloads/videos",
        on_progress: Optional[Callable] = None,
        format_id: str = "",
        audio_only: bool = False,
        write_subs: bool = False,
    ) -> Dict[str, Any]:
        """
        异步下载 yt-dlp 支持的视频
        :return: {success, filepath, title, error}
        """
        try:
            import yt_dlp
        except ImportError:
            return {"success": False, "error": "yt-dlp 未安装，请 pip install yt-dlp"}

        def _run() -> Dict[str, Any]:
            opts = cls._build_opts(output_dir, on_progress, format_id, audio_only, write_subs)
            try:
                with yt_dlp.YoutubeDL(opts) as ydl:
                    info = ydl.extract_info(url, download=True)
                    filepath = ydl.prepare_filename(info)
                    # 合并后扩展名可能变（如 webm → mp4）
                    if not os.path.exists(filepath):
                        base, _ = os.path.splitext(filepath)
                        for ext in (".mp4", ".mkv", ".webm"):
                            if os.path.exists(base + ext):
                                filepath = base + ext
                                break
                    return {
                        "success": True,
                        "filepath": filepath,
                        "title": info.get("title", ""),
                        "duration": info.get("duration", 0),
                        "uploader": info.get("uploader", ""),
                    }
            except Exception as e:
                return {"success": False, "error": str(e)}

        return await asyncio.to_thread(_run)

    @classmethod
    async def extract_info(cls, url: str) -> Dict[str, Any]:
        """只解析不下载，拿标题/封面/时长"""
        try:
            import yt_dlp
        except ImportError:
            return {"success": False, "error": "yt-dlp 未安装"}

        def _run() -> Dict[str, Any]:
            try:
                with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True}) as ydl:
                    info = ydl.extract_info(url, download=False)
                    return {
                        "success": True,
                        "title": info.get("title", ""),
                        "duration": info.get("duration", 0),
                        "uploader": info.get("uploader", ""),
                        "thumbnail": info.get("thumbnail", ""),
                        "ext": info.get("ext", ""),
                    }
            except Exception as e:
                return {"success": False, "error": str(e)}

        return await asyncio.to_thread(_run)
