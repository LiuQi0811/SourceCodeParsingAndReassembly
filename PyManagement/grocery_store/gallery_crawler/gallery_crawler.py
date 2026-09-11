"""
拾光壁纸 (gallery.timeline.ink) 全站爬虫
- 完美逆向AES-CBC加密URL解密
- 自动设备指纹注册
- 支持: 最新/热门/随机/专题/图源 全量抓取
- 自动下载原图到本地
"""

import requests
import hashlib
import random
import time
import os
import re
import json
import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
from urllib.parse import urlparse, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock


# ============ AES解密 (完美逆向 en.min.js) ============

def md5(s: str) -> str:
    return hashlib.md5(s.encode()).hexdigest()


def decrypt_aes(hex_cipher: str, key: str) -> str:
    """
    逆向 en.min.js 的 decryptAes 函数:
      e = key.repeat(16).slice(-16)  → key用最后16字符作为AES key
      r = md5(e).slice(8, 24)       → IV = md5(key)[8:24] (16字符)
      mode: CBC, padding: ZeroPadding
    """
    if not hex_cipher or not key:
        return hex_cipher
    # 补齐key到16字节: e.repeat(16).slice(-16)
    key_padded = (key * 16)[-16:]
    # IV
    iv = md5(key_padded)[8:24]
    try:
        # hex转bytes再base64 (JS中: CryptoJS.enc.Base64.stringify(CryptoJS.enc.Hex.parse(t)))
        cipher_bytes = bytes.fromhex(hex_cipher)
        cipher_b64 = base64.b64encode(cipher_bytes).decode()
        cipher = AES.new(key_padded.encode('utf-8'), AES.MODE_CBC, iv.encode('utf-8'))
        decrypted = cipher.decrypt(base64.b64decode(cipher_b64))
        # ZeroPadding unpad
        decrypted = decrypted.rstrip(b'\x00')
        return decrypted.decode('utf-8')
    except Exception:
        return hex_cipher


def decrypt_url(url: str, key: str) -> str:
    """
    逆向 en.min.js 的 decryptUrl 函数:
      取URL路径最后一段文件名（去掉扩展名），如果长度>=32:
        前32字符是AES密文(hex)，解密后与剩余部分拼接
    """
    if not url or not key:
        return url
    # 分离query
    if '?' in url:
        path_part, query = url.split('?', 1)
        query = '?' + query
    else:
        path_part, query = url, ''
    # 分离文件名
    segments = path_part.split('/')
    last = segments[-1]
    if '.' in last:
        name, ext = last.rsplit('.', 1)
        ext = '.' + ext
    else:
        name, ext = last, ''
    if len(name) < 32:
        return url
    enc_part = name[:32]
    rest_part = name[32:]
    dec_part = decrypt_aes(enc_part, key)
    new_name = dec_part + rest_part
    segments[-1] = new_name + ext
    return '/'.join(segments) + query


# ============ 爬虫主体 ============

class GalleryCrawler:
    BASE = "https://gallery.timeline.ink"
    API = "https://api.nguaduot.cn"

    def __init__(self, save_dir="./wallpapers", workers=8):
        self.save_dir = save_dir
        self.workers = workers
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        })
        # 生成设备指纹 (32位hex, 模拟FingerprintJS输出)
        self.fp = hashlib.md5(f"{random.random()}{time.time()}".encode()).hexdigest()
        self.session.headers['Timeline-Client'] = 'timelineweb'
        self.session.headers['Timeline-Device'] = self.fp
        self.session.headers['Origin'] = self.BASE
        self.downloaded = set()
        self.lock = Lock()
        os.makedirs(save_dir, exist_ok=True)
        self._register_device()

    def _register_device(self):
        """注册设备 (必须先调，否则无访问权限)"""
        payload = {
            'screenw': 1920,
            'screenh': 1080,
            'dpr': 1,
            'timezone': 'Asia/Shanghai',
            'lang': 'zh-CN',
        }
        try:
            r = self.session.post(f'{self.API}/appstats/web', json=payload, timeout=10)
            print(f"[设备注册] status={r.json().get('status')} fp={self.fp}")
        except Exception as e:
            print(f"[设备注册失败] {e}")

    def _fetch_page(self, endpoint, referer, max_pages=50):
        """通用分页抓取"""
        self.session.headers['Referer'] = referer
        no = 99999999
        all_items = []
        seen_ids = set()
        page = 0
        empty_streak = 0
        while page < max_pages:
            url = endpoint.replace('{no}', str(no)).replace('{id}', '')
            try:
                r = self.session.get(url, timeout=15)
                j = r.json()
            except Exception as e:
                print(f"[请求失败] {e}")
                break
            if j.get('status') != 1:
                print(f"[API返回错误] {j.get('msg')}")
                break
            items = j.get('data', [])
            if not items:
                break
            new_count = 0
            min_no_in_page = None
            for it in items:
                iid = str(it['id'])
                if iid not in seen_ids:
                    seen_ids.add(iid)
                    # 解密URL
                    try:
                        it['imgurl'] = decrypt_url(it['imgurl'], it['rawprovider'])
                        it['thumburl'] = decrypt_url(it['thumburl'], it['rawprovider'])
                    except Exception:
                        pass
                    all_items.append(it)
                    new_count += 1
                if min_no_in_page is None or it['no'] < min_no_in_page:
                    min_no_in_page = it['no']
            page += 1
            print(f"  第{page}页 新增{new_count}条 累计{len(all_items)}条")
            if new_count == 0:
                empty_streak += 1
                if empty_streak >= 2:
                    break
            else:
                empty_streak = 0
            if min_no_in_page is None:
                break
            next_no = min_no_in_page - 1
            if next_no >= no:
                break
            no = next_no
            time.sleep(0.2)
        return all_items

    def fetch_latest(self, max_pages=30):
        """抓取最新壁纸"""
        print("\n[最新壁纸]")
        seed = int(time.time() * 1000)
        endpoint = f'{self.API}/snake/v4?order=date&seed={seed}&no={{no}}&id={{id}}&catehow=&catewhat='
        return self._fetch_page(endpoint, f'{self.BASE}/latest', max_pages=max_pages)

    def fetch_hot(self, max_pages=10):
        """抓取热门壁纸"""
        print("\n[热门壁纸]")
        endpoint = f'{self.API}/snake/v4?order=score&no={{no}}&id={{id}}&catehow=&catewhat='
        return self._fetch_page(endpoint, f'{self.BASE}/hot', max_pages=max_pages)

    def fetch_rand(self, pages=5):
        """抓取随机壁纸 (多页随机seed)"""
        print("\n[随机壁纸]")
        all_items = []
        seen = set()
        for p in range(pages):
            seed = int(time.time() * 1000)
            endpoint = f'{self.API}/snake/v4?order=random&seed={seed}&no=99999999&id=&catehow=&catewhat='
            self.session.headers['Referer'] = f'{self.BASE}/rand'
            try:
                r = self.session.get(endpoint, timeout=15)
                j = r.json()
                if j.get('status') == 1:
                    for it in j.get('data', []):
                        if it['id'] not in seen:
                            seen.add(it['id'])
                            it['imgurl'] = decrypt_url(it['imgurl'], it['rawprovider'])
                            it['thumburl'] = decrypt_url(it['thumburl'], it['rawprovider'])
                            all_items.append(it)
                    print(f"  随机第{p+1}批: 累计{len(all_items)}条")
            except Exception as e:
                print(f"  随机请求失败: {e}")
            time.sleep(0.5)
        return all_items

    def fetch_topics(self):
        """抓取专题列表"""
        print("\n[专题列表]")
        endpoint = f'{self.API}/snake/v4/topic?stock=10&mobile=0&keyword='
        self.session.headers['Referer'] = self.BASE
        try:
            r = self.session.get(endpoint, timeout=15)
            j = r.json()
            if j.get('status') == 1:
                topics = j.get('data', [])
                print(f"  获取到{len(topics)}个专题")
                return topics
        except Exception as e:
            print(f"  专题列表失败: {e}")
        return []

    def fetch_topic(self, topic_id):
        """抓取某专题下的壁纸"""
        print(f"\n[专题] {topic_id}")
        seed = int(time.time() * 1000)
        endpoint = f'{self.API}/snake/v4?order=date&seed={seed}&no={{no}}&id={{id}}&catehow=&catewhat=&topic={requests.utils.quote(topic_id)}'
        return self._fetch_page(endpoint, f'{self.BASE}/?t={requests.utils.quote(topic_id)}')

    def fetch_providers(self):
        """抓取图源列表(封面)"""
        print("\n[图源列表]")
        endpoint = f'{self.API}/snake/v4/cover'
        self.session.headers['Referer'] = f'{self.BASE}/feed'
        try:
            r = self.session.get(endpoint, timeout=15)
            j = r.json()
            if j.get('status') == 1:
                providers = j.get('data', [])
                print(f"  获取到{len(providers)}个图源")
                return providers
        except Exception as e:
            print(f"  图源列表失败: {e}")
        return []

    def fetch_provider(self, provider_id, order='date'):
        """抓取某图源的壁纸"""
        print(f"\n[图源] {provider_id} order={order}")
        seed = int(time.time() * 1000)
        o_map = {'date': 'date', 'hot': 'score', 'rand': 'random'}
        o = o_map.get(order, 'date')
        if o == 'random':
            endpoint = f'{self.API}/snake/v4?order=random&seed={seed}&no={{no}}&id={{id}}&catehow=&catewhat=&provider={provider_id}'
        else:
            endpoint = f'{self.API}/snake/v4?order={o}&seed={seed}&no={{no}}&id={{id}}&catehow=&catewhat=&provider={provider_id}'
        return self._fetch_page(endpoint, f'{self.BASE}/feed/{provider_id}')

    def _download_one(self, item, subdir=""):
        """下载单张原图"""
        img_id = item['id']
        url = item['imgurl']
        provider = item['rawprovider']
        ext = item.get('ext', os.path.splitext(urlparse(url).path)[1] or '.jpg')
        if not ext.startswith('.'):
            ext = '.' + ext
        # 安全文件名
        title = re.sub(r'[\\/:*?"<>|]', '_', item.get('title', '')[:50]).strip()
        if not title:
            title = f"{provider}_{item.get('rawid', img_id)}"
        filename = f"{title}_{item.get('width','')}x{item.get('height','')}{ext}"
        # 按图源分目录
        d = os.path.join(self.save_dir, subdir, provider)
        os.makedirs(d, exist_ok=True)
        fpath = os.path.join(d, filename)
        with self.lock:
            if fpath in self.downloaded or os.path.exists(fpath):
                return fpath, False
            self.downloaded.add(fpath)
        try:
            # 不带Referer (避免部分CDN防盗链403, 如dtstatic/duitang屏蔽gallery.timeline.ink)
            dl_headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                              '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                'Referrer-Policy': 'no-referrer',
            }
            # 对duitang/dtstatic 用duitang referer；其他不带referer
            if 'duitang' in url or 'dtstatic' in url:
                dl_headers['Referer'] = 'https://www.duitang.com/'
            r = requests.get(url, timeout=60, stream=True, headers=dl_headers)
            if r.status_code == 200 and len(r.content) > 1024:
                with open(fpath, 'wb') as f:
                    for chunk in r.iter_content(65536):
                        f.write(chunk)
                size_kb = os.path.getsize(fpath) / 1024
                return fpath, True
            else:
                return fpath, False
        except Exception as e:
            return None, False

    def download_all(self, items, subdir=""):
        """多线程下载"""
        print(f"\n[下载] 共{len(items)}张到 {self.save_dir}/{subdir}")
        success = 0
        fail = 0
        with ThreadPoolExecutor(max_workers=self.workers) as ex:
            futures = {ex.submit(self._download_one, it, subdir): it for it in items}
            for i, fut in enumerate(as_completed(futures), 1):
                path, ok = fut.result()
                if ok:
                    success += 1
                else:
                    fail += 1
                if i % 20 == 0 or i == len(items):
                    print(f"  进度 {i}/{len(items)}  成功={success} 失败={fail}")
        print(f"[下载完成] 成功={success} 失败={fail}")
        return success, fail

    def crawl_all(self, include_topics=True, max_topics=0, download=True):
        """全站抓取入口"""
        all_meta = []

        # 1. 最新
        latest = self.fetch_latest()
        all_meta.extend(latest)
        if download and latest:
            self.download_all(latest, "latest")

        # 2. 热门
        hot = self.fetch_hot()
        hot_new = [h for h in hot if h['id'] not in {m['id'] for m in all_meta}]
        all_meta.extend(hot_new)
        if download and hot_new:
            self.download_all(hot_new, "hot")

        # 3. 随机 (多批)
        rand = self.fetch_rand(pages=3)
        rand_new = [r for r in rand if r['id'] not in {m['id'] for m in all_meta}]
        all_meta.extend(rand_new)
        if download and rand_new:
            self.download_all(rand_new, "rand")

        # 4. 专题
        if include_topics:
            topics = self.fetch_topics()
            ext_topic = []
            # 扩展数据中的推荐专题也处理
            # 限制专题数量
            if max_topics > 0:
                topics = topics[:max_topics]
            for t in topics:
                tid = t.get('id', '')
                ttitle = t.get('title', tid)
                if not tid:
                    continue
                time.sleep(0.5)
                items = self.fetch_topic(tid)
                new_items = [it for it in items if it['id'] not in {m['id'] for m in all_meta}]
                all_meta.extend(new_items)
                ext_topic.extend(new_items)
                if download and new_items:
                    safe_name = re.sub(r'[\\/:*?"<>|]', '_', ttitle)
                    self.download_all(new_items, f"topics/{safe_name}")

        # 保存元数据
        meta_path = os.path.join(self.save_dir, "metadata.json")
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(all_meta, f, ensure_ascii=False, indent=2)
        print(f"\n[元数据] 已保存到 {meta_path}, 共{len(all_meta)}条")
        return all_meta


# ============ 命令行入口 ============

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='拾光壁纸 (gallery.timeline.ink) 全站爬虫')
    parser.add_argument('-o', '--output', default='./wallpapers', help='保存目录 (默认: ./wallpapers)')
    parser.add_argument('-w', '--workers', type=int, default=8, help='下载并发数 (默认: 8)')
    parser.add_argument('--no-download', action='store_true', help='仅抓取元数据不下载图片')
    parser.add_argument('--no-topics', action='store_true', help='跳过专题抓取')
    parser.add_argument('--max-topics', type=int, default=0, help='最多抓取几个专题(0=全部)')
    parser.add_argument('--mode', choices=['all', 'latest', 'hot', 'rand', 'topics', 'providers'],
                        default='all', help='抓取模式 (默认: all)')
    args = parser.parse_args()

    crawler = GalleryCrawler(save_dir=args.output, workers=args.workers)

    do_download = not args.no_download

    if args.mode == 'all':
        crawler.crawl_all(include_topics=not args.no_topics,
                          max_topics=args.max_topics,
                          download=do_download)
    elif args.mode == 'latest':
        items = crawler.fetch_latest()
        if do_download:
            crawler.download_all(items, "latest")
    elif args.mode == 'hot':
        items = crawler.fetch_hot()
        if do_download:
            crawler.download_all(items, "hot")
    elif args.mode == 'rand':
        items = crawler.fetch_rand(pages=5)
        if do_download:
            crawler.download_all(items, "rand")
    elif args.mode == 'topics':
        topics = crawler.fetch_topics()
        all_items = []
        limit = args.max_topics if args.max_topics > 0 else len(topics)
        for t in topics[:limit]:
            tid = t.get('id', '')
            ttitle = t.get('title', tid)
            if tid:
                items = crawler.fetch_topic(tid)
                all_items.extend(items)
                if do_download:
                    safe_name = re.sub(r'[\\/:*?"<>|]', '_', ttitle)
                    crawler.download_all(items, f"topics/{safe_name}")
                time.sleep(0.5)
    elif args.mode == 'providers':
        providers = crawler.fetch_providers()
        print("图源列表:")
        for p in providers:
            print(f"  - {p.get('id')}: {p.get('title')}")
