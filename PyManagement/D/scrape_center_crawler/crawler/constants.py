# -*- coding: utf-8 -*-
"""全局常量定义"""

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

DEFAULT_HEADERS = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3"
    ),
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}


class ResourceType:
    """内置资源分类（可扩展自定义类型）"""

    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    ARCHIVE = "archive"
    CODE = "code"
    DATA = "data"
    OTHER = "other"

    # 分类目录名
    DIR_NAMES = {
        IMAGE: "images",
        VIDEO: "videos",
        AUDIO: "audios",
        DOCUMENT: "documents",
        ARCHIVE: "archives",
        CODE: "code",
        DATA: "data",
        OTHER: "other",
    }


class VideoProtocol:
    """视频流协议"""

    HLS = "hls"        # m3u8
    DASH = "dash"      # mpd
    FLV = "flv"        # http-flv
    RTMP = "rtmp"
    RTSP = "rtsp"
    WEBRTC = "webrtc"

    # URL 特征 → 协议
    PROTOCOL_PATTERNS = (
        ("webrtc://", WEBRTC),
        ("rtmp://", RTMP),
        ("rtsp://", RTSP),
        ("rtmps://", RTMP),
        (".m3u8", HLS),
        (".mpd", DASH),
        (".flv", FLV),
    )


class EventType:
    """事件类型（观察者模式事件总线使用）"""

    CRAWL_START = "crawl_start"
    TASK_START = "task_start"
    URL_DISCOVERED = "url_discovered"
    FETCH_START = "fetch_start"
    FETCH_OK = "fetch_ok"
    FETCH_ERROR = "fetch_error"                        # 单次抓取尝试失败（可重试）
    PAGE_FAILED = "page_failed"                        # 页面最终失败（重试耗尽/不可重试）
    PARSE_DONE = "parse_done"
    RESOURCE_FOUND = "resource_found"
    RESOURCE_DOWNLOAD_START = "resource_download_start"
    RESOURCE_DOWNLOAD_OK = "resource_download_ok"
    RESOURCE_DOWNLOAD_ERROR = "resource_download_error"  # 单次下载尝试失败（可重试）
    RESOURCE_FAILED = "resource_failed"                  # 资源最终失败（重试耗尽/不可重试）
    VIDEO_MERGE_START = "video_merge_start"
    VIDEO_MERGE_OK = "video_merge_ok"
    VIDEO_MERGE_ERROR = "video_merge_error"
    TASK_DONE = "task_done"
    CRAWL_DONE = "crawl_done"
    ERROR = "error"
