#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
decrypt_utils.py — hercbb.com 前端加密/JS逆向辅助函数库
================================================================

在 spider.py 中通过 from decrypt_utils import * 引入后，
在 decrypt_payload() 内调用下列函数，即可完成常见的前端解密。

若需要针对 hercbb.com 具体加密算法做逆向，请按下列步骤：
  1) 用 Playwright 打开网站，拦截 XHR/fetch 响应；
  2) 在浏览器 devtools 中搜索加密关键字（eval/atob/decrypt/AES/CryptoJS/WordsArray）；
  3) 把核心JS抠出后用 eval_js() 直接在 Python 中复用，或翻译成 Python；
  4) 结果替换到 decrypt_payload() 即可。

下面预置了常用工具，开箱即用。
"""

import re, base64, json, hashlib, time, random, string
from urllib.parse import unquote
from typing import Optional

# ---------- 1. 执行JS片段（优先用 Playwright 环境，避免 node 依赖） ----------
_JS_PAGE = None
def eval_js(js_code: str, expr: str = None) -> str:
    """
    在真实浏览器上下文执行JS。expr 是要取的返回表达式（若 None 则直接eval最后一段）。
    适合：拿到5秒盾生成的cookie、瑞数/极验/阿里验证码、混淆加密字符串的解密。
    """
    global _JS_PAGE
    try:
        from playwright.sync_api import sync_playwright
        if _JS_PAGE is None:
            _pw = sync_playwright().start()
            _br = _pw.chromium.launch(headless=True)
            _ctx = _br.new_context()
            _JS_PAGE = _ctx.new_page()
        if expr:
            return _JS_PAGE.evaluate(f'() => {{ {js_code}; return {expr}; }}')
        return _JS_PAGE.evaluate(f'() => {{ return eval({json.dumps(js_code)}); }}')
    except Exception as e:
        raise RuntimeError(f'JS执行失败(请安装playwright+chromium): {e}')


# ---------- 2. 常见混淆/编码还原 ----------
def is_base64(s: str) -> bool:
    try:
        s = s.strip()
        if len(s) % 4 != 0: return False
        return bool(re.match(r'^[A-Za-z0-9+/]+={0,2}$', s))
    except:
        return False

def b64(s: str) -> bytes:
    """base64 自动补 padding"""
    s = s.strip()
    s += '=' * (-len(s) % 4)
    return base64.b64decode(s)

def decode_unicode_escapes(s: str) -> str:
    """解码 \\uXXXX \\xXX 字符串"""
    return s.encode('utf-8').decode('unicode_escape', errors='ignore')

def static_reverse_eval_pack(js_pack: str) -> str:
    """
    还原 p.a.c.k.e.r / Dean Edwards packer 类压缩：
    eval(function(p,a,c,k,e,d){...})
    纯Python静态解包（不执行JS），用于去除最简单的eval混淆。
    """
    m = re.search(r"}\('(.*)',\s*(\d+),\s*(\d+),\s*'(.*?)'\.split\|", js_pack, re.S)
    if not m:
        return js_pack
    payload, a, c, dict_str = m.groups()
    words = dict_str.split('|')
    def repl(mm):
        idx = int(mm.group(1))
        return words[idx] if idx < len(words) and words[idx] else mm.group(0)
    # packer 用 62 进制变量名
    base62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    def rb(s):
        num = 0
        for ch in s:
            num = num * 62 + base62.index(ch)
        return str(num)
    payload = re.sub(r'\b([a-zA-Z0-9]+)\b', lambda mm: repl(re.match(r'(\d+)', rb(mm.group(1))) or mm), payload)
    return payload


# ---------- 3. CryptoJS AES/DES 等对称加密的解密（pycryptodome） ----------
def try_decrypt_aes_cbc(data_b64: str, key, iv=None, pad_mode='pkcs7') -> bytes:
    """AES-CBC 解密；key/iv 可为 str 或 bytes。若站点CryptoJS默认用UTF8口令派生，需先MD5/SHA256。"""
    from Crypto.Cipher import AES
    from Crypto.Util.Padding import unpad
    if isinstance(key, str): key = key.encode('utf-8')
    if isinstance(iv, str): iv = iv.encode('utf-8')
    if iv is None: iv = key[:16]
    ct = b64(data_b64)
    cipher = AES.new(key, AES.MODE_CBC, iv=iv)
    pt = cipher.decrypt(ct)
    try:
        pt = unpad(pt, AES.block_size)
    except: pass
    return pt

def try_decrypt_aes_ecb(data_b64: str, key) -> bytes:
    from Crypto.Cipher import AES
    from Crypto.Util.Padding import unpad
    if isinstance(key, str): key = key.encode('utf-8')
    ct = b64(data_b64)
    cipher = AES.new(key, AES.MODE_ECB)
    pt = cipher.decrypt(ct)
    try: pt = unpad(pt, AES.block_size)
    except: pass
    return pt


# ---------- 4. 常见JS Cookie挑战辅助 ----------
def solve_jschl(js_ch: str) -> dict:
    """
    针对 __jsl_clearance / __jsluid_s 这类 5秒盾 JS 挑战：
    传入 challenge 页面的 <script> 代码，返回设置好的 cookies dict。
    这里直接交给 eval_js 处理（最稳妥）。
    """
    js = js_ch + """
    var fake_doc = {cookie:''};
    var document = fake_doc;
    try { eval(arguments[0]); } catch(e){}
    fake_doc.cookie;
    """
    out = eval_js(js)
    cookies = {}
    for kv in out.split(';'):
        if '=' in kv:
            k,v = kv.split('=',1)
            cookies[k.strip()] = v.strip()
    return cookies


# ---------- 5. 字体反爬：把 woff 映射回真实文字（模板示例） ----------
_woff_cache = {}
def font_map_get(woff_url: str, fetcher_get_fn) -> dict:
    """
    解析自定义 woff/ttf 字体，按字形坐标匹配返回 {glyph_name_or_index: real_char}。
    实际站点需结合其字体XML cmap/glyf 表做匹配；本函数提供骨架。
    """
    if woff_url in _woff_cache:
        return _woff_cache[woff_url]
    try:
        from fontTools.ttLib import TTFont
        import io
        _, _, body = fetcher_get_fn(woff_url)
        font = TTFont(io.BytesIO(body))
        cmap = font.getBestCmap()
        glyph_map = {}
        # 真实映射需要对比基准字体
        _woff_cache[woff_url] = glyph_map
        return glyph_map
    except Exception as e:
        return {}


# ---------- 6. 签名/指纹辅助（常用算法） ----------
def md5hex(s: str) -> str:
    return hashlib.md5(s.encode('utf-8')).hexdigest()

def sha256hex(s: str) -> str:
    return hashlib.sha256(s.encode('utf-8')).hexdigest()

def rand_hex(n: int = 16) -> str:
    return ''.join(random.choice(string.hexdigits.lower()) for _ in range(n))

def ts_ms() -> int:
    return int(time.time()*1000)


# ---------- 7. 接口签名示例：若 hercbb.com 存在 sign/nonce/timestamp 可在此实现 ----------
def sign_api(params: dict, token: str = '') -> dict:
    """
    通用签名模板：按 key 排序 + token + MD5
    真实站点请根据其 JS 中的签名逻辑替换实现。
    """
    p = dict(params)
    p['timestamp'] = p.get('timestamp', ts_ms())
    p['nonce'] = p.get('nonce', rand_hex(8))
    items = sorted(p.items())
    raw = '&'.join(f'{k}={v}' for k,v in items) + token
    p['sign'] = md5hex(raw)
    return p


# ---------- 8. 一键把常见 HTML 中的反爬加密块识别并标记 ----------
def detect_obfuscation(html: str) -> list:
    """检测页面中疑似加密/混淆的片段，返回[(类型,片段预览)]"""
    hits = []
    if 'jschl_vc' in html or '__jsl_clearance' in html:
        hits.append(('js_cookie_5s', '5秒盾Cookie挑战'))
    if re.search(r'<script[^>]*>\s*eval\(function\(p,a,c,k,e', html):
        hits.append(('packer', 'p.a.c.k.e.r 压缩混淆'))
    if re.search(r'atob\(["\']', html):
        hits.append(('atob_b64', '包含 atob base64 执行'))
    if '_0x' in html and len(re.findall(r'_0x[0-9a-f]{3,6}', html)) > 10:
        hits.append(('obfuscator', 'AAEncode/Obfuscator 混淆'))
    if re.search(r'CryptoJS\.AES', html):
        hits.append(('cryptojs_aes', 'CryptoJS AES加密'))
    if '@font-face' in html and re.search(r'woff2?\?v=', html):
        hits.append(('font_anti', '字体反爬'))
    return hits


if __name__ == '__main__':
    # 自检
    print('decrypt_utils 加载完成。关键函数：')
    print('  eval_js / b64 / static_reverse_eval_pack / try_decrypt_aes_cbc')
    print('  solve_jschl / font_map_get / sign_api / detect_obfuscation')
