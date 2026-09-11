#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
城通网盘(ctfile.com) 直链解析下载器 - 增强版
支持多种页面版本和API端点，自动处理加密参数、倒计时、跳转

使用方法:
    python ctfile_downloader.py <城通网盘URL> [保存目录]
"""

import os
import re
import sys
import json
import time
import hashlib
import requests
from urllib.parse import urljoin, quote, unquote, urlparse, parse_qs

DEFAULT_PASSWORD = "txtxiaoshuo"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}


class CtfileDownloader:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)

    def _safe_get(self, url, headers=None, retries=3, timeout=30, **kwargs):
        if headers is None:
            headers = {}
        h = {**HEADERS, **headers}
        for i in range(retries):
            try:
                r = self.session.get(url, headers=h, timeout=timeout, allow_redirects=True, **kwargs)
                if r.status_code == 200:
                    r.encoding = r.apparent_encoding or "utf-8"
                    return r
                print(f"  [!] HTTP {r.status_code}, 重试 ({i+1}/{retries})...")
            except Exception as e:
                print(f"  [!] 请求异常: {e}, 重试 ({i+1}/{retries})...")
            time.sleep(2 ** i)
        return None

    def _safe_post(self, url, data=None, headers=None, retries=3, timeout=30, **kwargs):
        if headers is None:
            headers = {}
        h = {**HEADERS, **headers}
        for i in range(retries):
            try:
                r = self.session.post(url, data=data, headers=h, timeout=timeout, allow_redirects=True, **kwargs)
                if r.status_code == 200:
                    r.encoding = r.apparent_encoding or "utf-8"
                    return r
            except Exception as e:
                print(f"  [!] POST异常: {e}, 重试...")
            time.sleep(2 ** i)
        return None

    def _extract_ids(self, url):
        """从URL中提取uid, fid, 密码"""
        password = DEFAULT_PASSWORD
        uid = None
        fid = None

        # 解析URL参数
        parsed = urlparse(url)
        qs = parse_qs(parsed.query)
        if 'p' in qs:
            password = qs['p'][0]

        # 格式1: https://url91.ctfile.com/f/37476991-1459925932-14c05c?p=xxx
        m = re.search(r'/f/(\d+)-(\d+)-([a-f0-9]+)', url)
        if m:
            uid = m.group(1)
            fid = m.group(2)
            # code = m.group(3)  # 第三段是文件校验码
            return uid, fid, password

        # 格式2: https://url91.ctfile.com/d/37476991-1459925932-14c05c
        m = re.search(r'/d/(\d+)-(\d+)-([a-f0-9]+)', url)
        if m:
            uid = m.group(1)
            fid = m.group(2)
            return uid, fid, password

        # 从HTML中提取
        return uid, fid, password

    def _submit_password(self, page_url, password):
        """如果页面需要密码，提交密码获取文件页"""
        r = self._safe_get(page_url)
        if not r:
            return None

        html = r.text
        # 检查是否有密码输入框
        if "passcode" in html or "password" in html.lower() or "访问密码" in html or "输入密码" in html:
            # 找form
            action_match = re.search(r'<form[^>]*action=["\']([^"\']+)["\']', html)
            action = action_match.group(1) if action_match else page_url
            if not action.startswith("http"):
                action = urljoin(page_url, action)

            # 找密码字段名
            pass_name = "p"
            name_match = re.search(r'name=["\'](passcode|password|pwd|pass_pwd|p)["\']', html)
            if name_match:
                pass_name = name_match.group(1)

            data = {pass_name: password}
            # 找其他隐藏字段
            for inp in re.finditer(r'<input[^>]*type=["\']hidden["\'][^>]*>', html):
                nm = re.search(r'name=["\']([^"\']+)["\']', inp.group(0))
                vl = re.search(r'value=["\']([^"\']*)["\']', inp.group(0))
                if nm and vl:
                    data[nm.group(1)] = vl.group(1)

            r = self._safe_post(action, data=data, headers={"Referer": page_url})
            return r.text if r else None

        return html

    def parse_download_link(self, url):
        """
        解析城通网盘分享链接，返回 (真实下载URL, 文件名)
        综合多种解析策略
        """
        uid, fid, password = self._extract_ids(url)
        print(f"[*] 解析: uid={uid}, fid={fid}, 密码={password}")

        # --------- 策略1: webapi.ctfile.com/getfile.php ---------
        if uid and fid:
            endpoints = [
                f"https://webapi.ctfile.com/getfile.php?fid={fid}&uid={uid}&p={password}",
                f"https://webapi.ctfile.com/getfile.php?fid={fid}&uid={uid}&p={password}&token={int(time.time()*1000)}",
                f"https://webapi.ctfile.com/get_file.php?fid={fid}&uid={uid}&passcode={password}",
            ]
            for api_url in endpoints:
                r = self._safe_get(api_url, headers={
                    "Referer": url,
                    "X-Requested-With": "XMLHttpRequest",
                    "Accept": "application/json, text/javascript, */*; q=0.01",
                })
                if r:
                    try:
                        data = r.json()
                        print(f"[*] API返回: code={data.get('code')}, keys={list(data.keys())[:5]}")
                        if data.get("code") == 200 or data.get("file"):
                            file_info = data.get("file", data) if isinstance(data, dict) else {}
                            downurl = file_info.get("downurl") or file_info.get("vipdurl") or file_info.get("url")
                            filename = file_info.get("file_name") or file_info.get("name")
                            if downurl:
                                print(f"[+] API获取下载链接成功")
                                return downurl, filename
                    except json.JSONDecodeError:
                        # 可能是JSONP
                        m = re.search(r'\((\{.+\})\)', r.text, re.DOTALL)
                        if m:
                            try:
                                data = json.loads(m.group(1))
                                if isinstance(data, dict):
                                    file_info = data.get("file", data)
                                    downurl = file_info.get("downurl") or file_info.get("vipdurl") or file_info.get("url")
                                    filename = file_info.get("file_name")
                                    if downurl:
                                        return downurl, filename
                            except:
                                pass

        # --------- 策略2: 获取页面，解析JS中的下载链接 ---------
        html = self._submit_password(url, password)
        if not html:
            return None, None

        # 提取文件名
        filename = None
        fn_patterns = [
            r'<h4[^>]*>(?:<[^>]+>)*\s*([^<]+\.(?:txt|zip|rar|7z|epub|pdf))',
            r'file_name["\s:=]+["\']([^"\']+\.(?:txt|zip|rar|7z))["\']',
            r'<title>\s*([^<\-\n]+?)\s*[-–—]\s*.*城通',
        ]
        for p in fn_patterns:
            m = re.search(p, html, re.IGNORECASE)
            if m:
                filename = m.group(1).strip()
                break

        # 从HTML/JS中提取所有可能的下载URL
        # 城通的下载链接通常在点击"普通下载"后，经过一个倒计时，通过AJAX请求获取
        # 可能的链接模式:
        url_patterns = [
            # 直接在JS变量中
            r'downurl\s*[=:]\s*["\']([^"\']+)["\']',
            r'download_url\s*[=:]\s*["\']([^"\']+)["\']',
            r'file_url\s*[=:]\s*["\']([^"\']+)["\']',
            r'url\s*:\s*["\']([^"\']*(?:down|download|file)[^"\']*)["\']',
            # data属性
            r'data-url=["\']([^"\']+)["\']',
            r'data-downurl=["\']([^"\']+)["\']',
            # 完整URL
            r'(https?://(?:d|dx|down|download|file|f\d+)\.ctfile\.com/[^"\'<>\s]+)',
            r'(https?://[^"\'<>\s]*\.ctfile\.com/[^"\'<>\s]*(?:download|down|getfile|file)[^"\'<>\s]*)',
            r'(https?://(?:[a-z0-9-]+\.)?(?:ctfile|cityandclouds|tomfd)[^"\'<>\s]+)',
        ]

        for pattern in url_patterns:
            matches = re.findall(pattern, html, re.IGNORECASE)
            for match in matches:
                durl = match if isinstance(match, str) else match[0]
                durl = durl.replace("\\/", "/").replace("\\u002F", "/")
                if durl.startswith("//"):
                    durl = "https:" + durl
                # 过滤掉明显不是下载链接的
                if any(skip in durl for skip in ["webstatic.", "hm.baidu", "css", ".js", ".png", ".jpg", ".gif", "favicon", "logo", "analytics"]):
                    continue
                if "ctfile" in durl or "cityandclouds" in durl or "tomfd" in durl:
                    # 验证一下这个URL是否能得到文件头
                    print(f"[*] 发现候选链接: {durl[:100]}...")
                    return durl, filename

        # --------- 策略3: 模拟点击"普通下载"按钮，获取跳转链接 ---------
        # 有些版本需要先POST到一个接口获取中间页
        if uid and fid:
            # 尝试点击普通下载API
            click_api_urls = [
                f"https://webapi.ctfile.com/get_file_url.php?uid={uid}&fid={fid}&p={password}&chos=0&websign=1&websignkey={int(time.time())}",
                f"https://www.ctfile.com/get_file_url.php?uid={uid}&fid={fid}&pass={password}",
            ]
            for api_url in click_api_urls:
                r = self._safe_get(api_url, headers={
                    "Referer": url,
                    "X-Requested-With": "XMLHttpRequest",
                })
                if r and r.text.strip():
                    text = r.text.strip()
                    # 尝试解析
                    try:
                        j = json.loads(text)
                        for k in ["downurl", "url", "download", "vipdurl"]:
                            if k in j and j[k]:
                                return j[k], filename
                    except:
                        pass
                    # 直接匹配URL
                    urls = re.findall(r'(https?://[^"\'\\\s&]+)', text)
                    for u in urls:
                        u = u.replace("\\/", "/")
                        if "ctfile" in u or "download" in u.lower():
                            return u, filename

        # --------- 策略4: 直接构造下载链接 (根据已知的URL规则) ---------
        if uid and fid:
            # 某些子域名格式: https://d.ctfile.com/download/uid/fid
            direct_urls = [
                f"https://d.ctfile.com/download/{uid}/{fid}?p={password}",
                f"https://dx.ctfile.com/file/{uid}/{fid}",
            ]
            for durl in direct_urls:
                try:
                    r = self.session.head(durl, headers=HEADERS, timeout=10, allow_redirects=True)
                    content_type = r.headers.get("Content-Type", "")
                    if "text/html" not in content_type and r.status_code == 200:
                        return durl, filename
                except:
                    pass

        print("[!] 所有解析策略均失败")
        return None, filename

    def download(self, url, save_dir=".", filename=None):
        """下载文件"""
        os.makedirs(save_dir, exist_ok=True)

        durl, detected_name = self.parse_download_link(url)
        if not durl:
            print("[!] 无法获取下载链接")
            return False

        if not filename:
            filename = detected_name or f"novel_{int(time.time())}.txt"
        filename = re.sub(r'[\\/:*?"<>|]', "_", filename)
        save_path = os.path.join(save_dir, filename)

        if os.path.exists(save_path) and os.path.getsize(save_path) > 1024:
            print(f"[=] 文件已存在: {save_path}")
            return save_path

        print(f"[*] 开始下载: {filename}")
        print(f"[*] URL: {durl[:120]}...")

        # 下载时可能需要跟随重定向
        max_redirects = 5
        current_url = durl
        for _ in range(max_redirects):
            try:
                r = self.session.get(current_url, headers={
                    **HEADERS,
                    "Referer": url,
                }, stream=True, timeout=60, allow_redirects=False)

                if r.status_code in (301, 302, 303, 307, 308):
                    location = r.headers.get("Location")
                    if location:
                        current_url = urljoin(current_url, location)
                        print(f"[*] 重定向到: {current_url[:100]}...")
                        continue

                if r.status_code != 200:
                    print(f"[!] HTTP {r.status_code}")
                    return False

                total = int(r.headers.get("content-length", 0))
                content_type = r.headers.get("Content-Type", "")

                if "text/html" in content_type and total < 50000:
                    # 可能是错误页面，读取内容看看
                    content = r.content
                    if b"<html" in content[:100].lower():
                        # 检查里面有没有真实文件链接
                        urls = re.findall(b'(https?://[^"\'\\<>\\s]+\\.(?:txt|zip|rar|7z)[^"\'\\<>\\s]*)', content, re.IGNORECASE)
                        if urls:
                            current_url = urls[0].decode("utf-8", errors="ignore")
                            continue
                        print(f"[!] 返回了HTML页面，下载可能需要在浏览器中进行")
                        # 保存HTML供调试
                        debug_path = save_path + ".debug.html"
                        with open(debug_path, "wb") as f:
                            f.write(content)
                        print(f"[!] 调试页面已保存到: {debug_path}")
                        return False

                downloaded = 0
                with open(save_path, "wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                            if total:
                                pct = downloaded * 100 // total
                                print(f"\r[*] 下载中: {pct}% ({downloaded/1024/1024:.1f}/{total/1024/1024:.1f} MB)", end="", flush=True)
                print()  # 换行

                if downloaded < 1024:
                    os.remove(save_path)
                    print(f"[!] 文件过小({downloaded}B)，下载失败")
                    return False

                print(f"[+] 下载完成: {save_path} ({downloaded/1024/1024:.2f} MB)")
                return save_path

            except Exception as e:
                print(f"[!] 下载异常: {e}")
                return False

        print("[!] 重定向次数过多")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python ctfile_downloader.py <城通网盘URL> [保存目录]")
        print("示例: python ctfile_downloader.py 'https://url91.ctfile.com/f/37476991-1459925932-14c05c?p=txtxiaoshuo' ./downloads")
        sys.exit(1)

    url = sys.argv[1]
    save_dir = sys.argv[2] if len(sys.argv) > 2 else "./downloads"

    dl = CtfileDownloader()
    result = dl.download(url, save_dir)
    if result:
        print(f"\n[√] 成功下载: {result}")
    else:
        print("\n[×] 下载失败")
