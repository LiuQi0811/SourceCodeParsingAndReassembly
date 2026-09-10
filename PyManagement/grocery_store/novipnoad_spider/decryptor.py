#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
解密模块 - 处理网站各种加密方式
支持：CryptoJS AES/DES 加密、Base64、URL 编码、m3u8 解密
自动从页面 JS 中提取加密密钥和 IV
"""
import re
import json
import base64
import hashlib
import logging
from urllib.parse import unquote
from Crypto.Cipher import AES, DES
from Crypto.Util.Padding import unpad, pad
from Crypto.Random import get_random_bytes

logger = logging.getLogger(__name__)


class Decryptor:
    """通用解密器，自动识别并解密影视站常见加密"""

    def __init__(self):
        self.key_patterns = [
            # CryptoJS 密钥提取
            re.compile(r'(?:key|CryptoJS\.AES\.decrypt|encrypt\()[^,;]*,\s*["\']([^"\']{8,32})["\']'),
            re.compile(r'(?:key|secret|password)\s*[:=]\s*["\']([^"\']{8,32})["\']'),
            re.compile(r'var\s+_\w+\s*=\s*["\']([^"\']{16,32})["\']'),
        ]
        self.iv_patterns = [
            re.compile(r'(?:iv|IV)\s*[:=]\s*["\']([^"\']{8,16})["\']'),
            re.compile(r'parse\(["\']([0-9a-fA-F]{16,32})["\']\)'),
        ]

    def extract_keys_from_js(self, js_code):
        """从 JS 代码中提取加密密钥和 IV"""
        keys_found = set()
        ivs_found = set()

        for pat in self.key_patterns:
            for m in pat.finditer(js_code):
                key = m.group(1)
                if 8 <= len(key) <= 32:
                    keys_found.add(key)

        for pat in self.iv_patterns:
            for m in pat.finditer(js_code):
                iv = m.group(1)
                if 8 <= len(iv) <= 16:
                    ivs_found.add(iv)

        logger.info(f"从 JS 中提取密钥: {keys_found}, IV: {ivs_found}")
        return list(keys_found), list(ivs_found)

    @staticmethod
    def auto_decode(encoded_str):
        """自动识别并解码多层编码（Base64/URL/Hex）"""
        if not isinstance(encoded_str, str):
            return encoded_str

        result = encoded_str
        last = None
        attempts = 0
        while result != last and attempts < 6:
            last = result
            attempts += 1

            # URL 解码
            try:
                decoded_url = unquote(result)
                if decoded_url != result:
                    result = decoded_url
            except:
                pass

            # Base64 解码
            try:
                # 判断是否像 base64
                if re.match(r'^[A-Za-z0-9+/=_]+$', result.strip()) and len(result) % 4 == 0:
                    padded = result + '=' * (-len(result) % 4)
                    decoded_b64 = base64.b64decode(padded).decode('utf-8', errors='ignore')
                    # 只有解码出可打印字符才采用
                    if any(32 <= ord(c) < 127 or ord(c) > 127 for c in decoded_b64):
                        result = decoded_b64
            except:
                pass

            # Hex 解码
            try:
                if re.match(r'^[0-9a-fA-F]+$', result.strip()) and len(result) % 2 == 0:
                    decoded_hex = bytes.fromhex(result).decode('utf-8', errors='ignore')
                    if any(32 <= ord(c) < 127 or ord(c) > 127 for c in decoded_hex):
                        result = decoded_hex
            except:
                pass

        return result

    @staticmethod
    def aes_decrypt(ciphertext, key, iv=None, mode=AES.MODE_CBC, output_format='str'):
        """
        AES 解密
        :param ciphertext: 密文（str 或 bytes）
        :param key: 密钥（自动填充到 16/24/32 字节）
        :param iv: 初始向量（CBC 模式必需）
        :param mode: AES 模式（CBC/ECB）
        :param output_format: 'str' 或 'bytes'
        """
        # 标准化密钥
        if isinstance(key, str):
            key = key.encode('utf-8')
        # AES 密钥长度必须是 16, 24, 32
        if len(key) <= 16:
            key = key.ljust(16, b'\x00')
        elif len(key) <= 24:
            key = key.ljust(24, b'\x00')
        else:
            key = key.ljust(32, b'\x00')

        # 处理密文
        if isinstance(ciphertext, str):
            # 先尝试 base64
            try:
                ciphertext = base64.b64decode(ciphertext)
            except:
                ciphertext = ciphertext.encode('utf-8')

        # 处理 IV
        if iv is not None:
            if isinstance(iv, str):
                iv = iv.encode('utf-8')
            iv = iv[:16].ljust(16, b'\x00')

        # 常见 CryptoJS 模式：key=md5(key) 或 sha256(key)
        candidates = [key]
        candidates.append(hashlib.md5(key).digest())
        candidates.append(hashlib.sha256(key).digest()[:16])
        candidates.append(hashlib.sha1(key).digest()[:16])

        for try_key in candidates:
            for try_iv in [iv, try_key, b'\x00' * 16, None] if mode == AES.MODE_CBC else [None]:
                try:
                    if mode == AES.MODE_CBC and try_iv:
                        cipher = AES.new(try_key, AES.MODE_CBC, iv=try_iv)
                    elif mode == AES.MODE_ECB:
                        cipher = AES.new(try_key, AES.MODE_ECB)
                    else:
                        continue
                    decrypted = cipher.decrypt(ciphertext)
                    try:
                        decrypted = unpad(decrypted, AES.block_size)
                    except:
                        pass  # 有些未做 padding
                    text = decrypted.decode('utf-8', errors='ignore')
                    # 验证结果是否像有效数据
                    if any(32 <= ord(c) < 127 or ord(c) > 127 for c in text) and len(text) > 2:
                        if output_format == 'bytes':
                            return decrypted
                        return text
                except Exception as e:
                    continue

        logger.debug("AES 解密失败，所有候选均不匹配")
        return None

    def brute_decrypt(self, ciphertext, page_js=None, known_keys=None):
        """
        暴力尝试各种常见密钥和模式解密接口响应
        :param ciphertext: 待解密内容
        :param page_js: 页面 JS 代码（用于提取密钥）
        :param known_keys: 已知密钥列表
        """
        if not ciphertext:
            return ciphertext

        # 1. 先尝试自动解码多层编码
        decoded = self.auto_decode(ciphertext)
        if decoded and ('http' in decoded or decoded.startswith('{') or decoded.startswith('[')):
            return decoded

        # 2. 收集候选密钥
        keys = set()
        if known_keys:
            keys.update(known_keys)
        if page_js:
            extracted_keys, _ = self.extract_keys_from_js(page_js)
            keys.update(extracted_keys)
        # 常见影视站密钥
        common_keys = [
            "NHZ3DdJm9aKsxQ2t", "novipnoad", "novip", "noad", "vipnoad",
            "1234567890123456", "abcdefghijklmnop", "0123456789abcdef",
            "20180516", "20190101", "20200202", "20210303", "20220404",
            "key2023novip", "noVideoKey!", "no@video#2024",
            "qwertyuiopasdfgh", "zxcvbnmlkjhgfdsa",
        ]
        keys.update(common_keys)

        # 3. 尝试 AES-CBC 和 AES-ECB
        for key in keys:
            for mode in [AES.MODE_CBC, AES.MODE_ECB]:
                result = self.aes_decrypt(ciphertext, key, mode=mode)
                if result and ('http' in result or 'm3u8' in result or result.startswith('{') or result.startswith('[')):
                    logger.info(f"AES 解密成功, key={key}, mode={mode}")
                    return result

        # 4. 直接返回原始（可能未加密）
        return decoded if decoded else ciphertext

    @staticmethod
    def decrypt_m3u8_key(key_data, key_uri):
        """解密 m3u8 的 EXT-X-KEY"""
        # 通常 key 本身就是 AES-128 key，直接返回
        return key_data

    @staticmethod
    def parse_player_config(html, script_text=None):
        """
        从播放器页面解析视频配置
        兼容 MacCms、AppleCMS、飞飞CMS 等常见影视站程序
        """
        configs = {}

        # 匹配 player_aaaa 等常见配置
        patterns = [
            re.compile(r'var\s+player_aaaa\s*=\s*(\{[^;]+\})', re.S),
            re.compile(r'var\s+player_(?:data|config|aaaa)\s*=\s*(\{[\s\S]+?\});'),
            re.compile(r'player_data\s*=\s*(\{[\s\S]+?\});'),
            re.compile(r'var\s+_(?:play|video|url)\s*=\s*["\']([^"\']+)["\']'),
            re.compile(r'(?:url|src|video_url|play_url)\s*[:=]\s*["\']([^"\']+\.(?:m3u8|mp4)[^"\']*)["\']'),
            re.compile(r'"(?:url|src|video_url|play_url|link)"\s*:\s*"([^"]+)"'),
        ]

        search_text = html + (script_text or "")
        for pat in patterns:
            for m in pat.finditer(search_text):
                val = m.group(1).strip()
                if val.startswith('{'):
                    try:
                        # 移除 JS 对象中的未引号键，转为合法 JSON
                        cleaned = re.sub(r'(\w+)\s*:', r'"\1":', val)
                        cleaned = cleaned.replace("'", '"')
                        cfg = json.loads(cleaned)
                        configs.update(cfg)
                    except:
                        pass
                else:
                    if 'url' not in configs or len(configs['url']) < len(val):
                        configs['url'] = val

        return configs


# 全局单例
decryptor = Decryptor()
