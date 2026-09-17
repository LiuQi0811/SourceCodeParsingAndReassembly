#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
视频下载模块
支持协议：
  - magnet:    磁力链接  → aria2c (BT下载)
  - thunder:// 迅雷专用链 → 解码后按真实协议下载
  - ed2k://    eMule     → 暂不支持（仅记录）
  - ftp(s)://  FTP       → aria2c / curl
  - http(s):// 直链      → aria2c / curl
  - 网盘链接    夸克/百度/阿里等 → 仅保存链接+提取码（需登录鉴权，不自动下载）
"""

import os
import re
import sys
import json
import time
import base64
import shutil
import logging
import subprocess
from urllib.parse import urlparse, unquote

# ============ 配置 ============
ARIA2C = shutil.which("aria2c")          # aria2c 可执行文件路径
CURL = shutil.which("curl")                # curl 可执行文件路径
DOWNLOAD_TIMEOUT = 3600                     # 单个任务最大下载时间（秒）
MAX_RETRY = 2                                # 下载失败重试次数

# 网盘域名（不自动下载，仅记录）
NETDISK_DOMAINS = [
    "pan.quark", "pan.baidu", "pan.xunlei", "aliyundrive",
    "alipan", "115.com", "drive.uc", "yunpan", "weiyun",
    "mega.nz", "cloud.189", "caiyun.139",
]

log = logging.getLogger("downloader")


# ============ 工具函数 ============
def safe_filename(name, max_len=120):
    """清理文件名中的非法字符"""
    name = re.sub(r'[\\/:*?"<>|\r\n\t]+', '_', name)
    name = re.sub(r'\s+', ' ', name).strip(' ._')
    if len(name) > max_len:
        name = name[:max_len].rstrip(' ._')
    return name or "unnamed"


def decode_thunder(thunder_url):
    """
    解码迅雷专用链接 thunder://
    编码规则：thunder:// + Base64("AA" + 真实URL + "ZZ")
    返回真实 URL，解码失败返回 None
    """
    if not thunder_url.startswith("thunder://"):
        return None
    try:
        encoded = thunder_url[len("thunder://"):].strip()
        # 补全 base64 padding
        padding = 4 - (len(encoded) % 4)
        if padding != 4:
            encoded += "=" * padding
        decoded = base64.b64decode(encoded).decode("utf-8", errors="ignore")
        # 去掉前后的 AA 和 ZZ
        if decoded.startswith("AA"):
            decoded = decoded[2:]
        if decoded.endswith("ZZ"):
            decoded = decoded[:-2]
        return decoded.strip()
    except Exception as e:
        log.warning(f"迅雷链接解码失败: {e}")
        return None


def is_netdisk(url):
    """判断是否为网盘链接"""
    domain = urlparse(url).netloc.lower()
    return any(k in domain for k in NETDISK_DOMAINS)


def classify_link(url):
    """
    分类链接类型，返回 (type, real_url)
    type: magnet / http / ftp / ed2k / netdisk / unknown
    """
    url = url.strip()
    if url.startswith("magnet:"):
        return "magnet", url
    if url.startswith("thunder://"):
        real = decode_thunder(url)
        if real:
            return classify_link(real)
        return "unknown", url
    if url.startswith("ed2k://"):
        return "ed2k", url
    if url.startswith("ftp://") or url.startswith("ftps://"):
        return "ftp", url
    if url.startswith("http://") or url.startswith("https://"):
        if is_netdisk(url):
            return "netdisk", url
        return "http", url
    return "unknown", url


# ============ 下载执行 ============
def _run_cmd(cmd, timeout, cwd=None):
    """运行外部命令，返回 (success, output)"""
    try:
        proc = subprocess.run(
            cmd, cwd=cwd, timeout=timeout,
            capture_output=True, text=True
        )
        return proc.returncode == 0, proc.stdout + proc.stderr
    except subprocess.TimeoutExpired:
        return False, "下载超时"
    except Exception as e:
        return False, str(e)


def download_magnet(magnet_url, save_dir, filename_hint=""):
    """
    磁力链接下载（aria2c BT 下载）
    注意：磁力下载是 P2P，速度取决于做种人数，可能很慢或无速度
    """
    if not ARIA2C:
        return False, "未安装 aria2c，无法下载磁力链接"
    os.makedirs(save_dir, exist_ok=True)
    cmd = [
        ARIA2C,
        "--dir=" + save_dir,
        "--bt-max-peers=50",
        "--bt-tracker-interval=60",
        "--seed-time=0",           # 下载完成后不做种
        "--max-connection-per-server=4",
        "--split=4",
        "--min-split-size=10M",
        "--console-log-level=warn",
        "--summary-interval=0",
        magnet_url,
    ]
    log.info(f"[磁力] 开始下载: {filename_hint or magnet_url[:60]}...")
    success, output = _run_cmd(cmd, DOWNLOAD_TIMEOUT, cwd=save_dir)
    if success:
        log.info(f"[磁力] 下载完成: {filename_hint}")
    else:
        log.warning(f"[磁力] 下载失败: {output[-200:]}")
    return success, output


def download_http(url, save_dir, filename=""):
    """HTTP/HTTPS 直链下载（优先 aria2c，备选 curl）"""
    os.makedirs(save_dir, exist_ok=True)
    if not filename:
        # 从 URL 提取文件名
        path = urlparse(url).path
        filename = os.path.basename(unquote(path)) or "download.bin"
    filename = safe_filename(filename)
    filepath = os.path.join(save_dir, filename)

    if ARIA2C:
        cmd = [
            ARIA2C,
            "--dir=" + save_dir,
            "--out=" + filename,
            "--max-connection-per-server=8",
            "--split=8",
            "--min-split-size=1M",
            "--continue=true",
            "--max-tries=3",
            "--retry-wait=5",
            "--console-log-level=warn",
            "--summary-interval=0",
            "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            url,
        ]
        log.info(f"[HTTP] aria2c 下载: {filename}")
        success, output = _run_cmd(cmd, DOWNLOAD_TIMEOUT)
    elif CURL:
        cmd = [
            CURL, "-L", "-C", "-",
            "--retry", "3", "--retry-delay", "5",
            "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "-o", filepath,
            url,
        ]
        log.info(f"[HTTP] curl 下载: {filename}")
        success, output = _run_cmd(cmd, DOWNLOAD_TIMEOUT)
    else:
        return False, "未安装 aria2c 或 curl"

    if success and os.path.exists(filepath) and os.path.getsize(filepath) > 0:
        log.info(f"[HTTP] 下载完成: {filename} ({os.path.getsize(filepath)} bytes)")
        return True, filepath
    else:
        return False, output[-300:] if output else "下载失败"


def download_ftp(url, save_dir, filename=""):
    """FTP 下载（aria2c 或 curl）"""
    # FTP 下载逻辑与 HTTP 类似，aria2c/curl 都原生支持
    return download_http(url, save_dir, filename)


# ============ 统一入口 ============
def download_link(url, save_dir, filename_hint=""):
    """
    统一下载入口：自动识别链接类型并下载
    返回 (success, message_or_path)
    """
    link_type, real_url = classify_link(url)

    if link_type == "magnet":
        return download_magnet(real_url, save_dir, filename_hint)

    elif link_type == "http":
        return download_http(real_url, save_dir, filename_hint)

    elif link_type == "ftp":
        return download_ftp(real_url, save_dir, filename_hint)

    elif link_type == "ed2k":
        return False, "ED2K 链接暂不支持自动下载（需 eMule 客户端），已记录链接"

    elif link_type == "netdisk":
        return False, "网盘链接不自动下载（需登录鉴权），已保存链接和提取码"

    else:
        return False, f"不支持的链接类型: {link_type}"


def download_movie(movie_data, base_dir, max_per_movie=2):
    """
    下载一部影片的资源
    movie_data: spider_6vdy.parse_detail() 返回的字典
    base_dir: 下载根目录，文件会存到 base_dir/分类/标题/
    max_per_movie: 最多下载几个链接（避免一部剧几十集全下）

    返回下载结果统计
    """
    title = safe_filename(movie_data.get("title", "unknown"))
    category = safe_filename(movie_data.get("category", "uncategorized"))
    save_dir = os.path.join(base_dir, category, title)

    results = {
        "title": title,
        "category": category,
        "save_dir": save_dir,
        "downloaded": [],
        "skipped": [],
        "failed": [],
    }

    # 收集所有可下载链接（按优先级：磁力 > HTTP直链 > FTP > 迅雷解码后）
    candidates = []
    for m in movie_data.get("magnets", []):
        candidates.append(("magnet", m["url"], m.get("text", "")))
    for t in movie_data.get("thunders", []):
        candidates.append(("thunder", t["url"], t.get("text", "")))
    for f in movie_data.get("ftps", []):
        candidates.append(("ftp", f["url"], f.get("text", "")))
    # netdisk 和 ed2k 不自动下载，记录到 skipped

    # 网盘链接记录到 skipped（保留链接供手动下载）
    for nd in movie_data.get("netdisks", []):
        results["skipped"].append({
            "type": "netdisk",
            "url": nd["url"],
            "text": nd.get("text", ""),
            "pwd": nd.get("pwd", ""),
            "reason": "网盘需登录鉴权",
        })
    for e in movie_data.get("ed2ks", []):
        results["skipped"].append({
            "type": "ed2k",
            "url": e["url"],
            "text": e.get("text", ""),
            "reason": "ED2K 需 eMule 客户端",
        })

    if not candidates:
        log.info(f"[{title}] 无可下载链接（仅网盘/ED2K）")
        return results

    # 限制下载数量
    candidates = candidates[:max_per_movie]
    log.info(f"[{title}] 准备下载 {len(candidates)} 个链接到 {save_dir}")

    for link_type, url, text in candidates:
        filename_hint = safe_filename(text) if text else ""
        for attempt in range(MAX_RETRY + 1):
            success, msg = download_link(url, save_dir, filename_hint)
            if success:
                results["downloaded"].append({
                    "type": link_type,
                    "url": url,
                    "text": text,
                    "path": msg if isinstance(msg, str) and os.path.exists(msg) else save_dir,
                })
                break
            elif attempt < MAX_RETRY:
                log.info(f"重试 {attempt+1}/{MAX_RETRY}: {text}")
                time.sleep(3)
            else:
                results["failed"].append({
                    "type": link_type,
                    "url": url,
                    "text": text,
                    "reason": msg[:200] if isinstance(msg, str) else str(msg),
                })

    return results


def save_download_report(report_list, output_path):
    """保存下载报告为 JSON"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report_list, f, ensure_ascii=False, indent=2)
    log.info(f"下载报告已保存: {output_path}")


if __name__ == "__main__":
    # 快速自测
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    # 测试迅雷链接解码
    test_thunder = "thunder://QUFodHRwOi8vZXhhbXBsZS5jb20vdGVzdC5tcDRaWg=="
    decoded = decode_thunder(test_thunder)
    print(f"迅雷解码测试: {test_thunder} -> {decoded}")

    # 测试链接分类
    test_urls = [
        "magnet:?xt=urn:btih:abc123",
        "thunder://QUFodHRwOi8vZXhhbXBsZS5jb20vdGVzdC5tcDRaWg==",
        "https://pan.quark.cn/s/abc123",
        "ftp://example.com/movie.mkv",
        "ed2k://|file|test.mkv|12345|ABCDEF|/",
        "https://example.com/video.mp4",
    ]
    for u in test_urls:
        t, real = classify_link(u)
        print(f"  {t:8s} | {real[:70]}")

    print(f"\naria2c: {ARIA2C or '未安装'}")
    print(f"curl:   {CURL or '未安装'}")
