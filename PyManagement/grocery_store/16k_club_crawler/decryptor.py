#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
解密模块 - 支持多种小说网站反爬解密
包含：字体解密、JS混淆解密、AES解密、Base64解密、CSS伪元素解密等
"""

import re
import os
import base64
import hashlib
from io import BytesIO
from typing import Dict, Optional, Tuple

try:
    from fontTools.ttLib import TTFont
    from fontTools.pens.freetypePen import FreeTypePen
    FONTTOOLS_AVAILABLE = True
except ImportError:
    FONTTOOLS_AVAILABLE = False

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import ddddocr
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

try:
    import execjs
    EXECJS_AVAILABLE = True
except ImportError:
    EXECJS_AVAILABLE = False

try:
    from Crypto.Cipher import AES
    from Crypto.Util.Padding import unpad
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False


class FontDecryptor:
    """字体反爬解密器 - 支持静态字体和动态字体"""

    def __init__(self):
        self.font_cache = {}
        self.ocr = None
        if OCR_AVAILABLE:
            self.ocr = ddddocr.DdddOcr(beta=False, show_ad=False)

    def download_font(self, font_url: str, session, headers: Dict = None) -> Optional[TTFont]:
        """下载并解析字体文件"""
        if not FONTTOOLS_AVAILABLE:
            print("[!] fontTools未安装，无法处理字体加密")
            return None

        try:
            if font_url in self.font_cache:
                return self.font_cache[font_url]

            response = session.get(font_url, headers=headers, timeout=30)
            if response.status_code != 200:
                return None

            font = TTFont(BytesIO(response.content))
            self.font_cache[font_url] = font
            return font
        except Exception as e:
            print(f"[!] 字体下载失败: {e}")
            return None

    def build_font_map_manual(self, font: TTFont) -> Dict[str, str]:
        """手动构建字体映射（需要人工核对字形）"""
        font_map = {}
        cmap = font.getBestCmap()

        # 获取glyph顺序，用于建立映射关系
        glyph_order = font.getGlyphOrder()

        # 常见的中文字符映射（基础版，需要根据具体网站扩展）
        common_chars = list("的一是了我不人在他有这个上们来到时大地为子中你说生国年着就那和要她出也得里后自以会家可下而过天去能对小多然于心学么之都好看起发当没成只如事把还用第样道想作种开美总从无情己面最女但现前些所同日手又行意动方期它头经长儿回位分爱老因很给名法间斯知世什两次使身者被高已亲其进此话常与活正感见明问力理尔点文几定本公特做外孩相西果走将月十实向声车全信重三机工物气每并别真打太新比才便夫再书部水像眼等体却加电主界门利海受听表德少克代员许稍先口由死安写性马光白或住难望教命花结乐色更拉东神记处让母父应直字场平报友关放至张认接告入笑内英军候民岁往何度山觉路带万男边风解叫任金快原吃妈变通师立象数四失满战远格士音轻目条呢病始达深完今提求清王化空业思切怎非找片罗钱吗语元喜曾离飞科言干网操酒落字给影算低持音众注布铁须满")

        # 建立字形索引到字符的映射（注意：这只是通用框架，实际需要针对字体文件调整）
        for i, glyph_name in enumerate(glyph_order):
            if glyph_name.startswith('uni'):
                try:
                    char_code = int(glyph_name[3:], 16)
                    # 这里需要根据实际字体调整映射关系
                    # 对于动态字体，需要使用OCR识别
                    pass
                except:
                    continue

        return font_map

    def build_font_map_ocr(self, font: TTFont, save_images: bool = False) -> Dict[str, str]:
        """使用OCR自动识别字体，构建映射表"""
        if not (FONTTOOLS_AVAILABLE and PIL_AVAILABLE and OCR_AVAILABLE):
            print("[!] 缺少必要库（fontTools/Pillow/ddddocr），无法OCR识别字体")
            return {}

        font_map = {}
        cmap = font.getBestCmap()

        try:
            glyph_set = font.getGlyphSet()
            temp_dir = "font_images"

            if save_images:
                os.makedirs(temp_dir, exist_ok=True)

            for char_code, glyph_name in cmap.items():
                try:
                    glyph = glyph_set[glyph_name]
                    pen = FreeTypePen(None)
                    glyph.draw(pen)
                    img_array = pen.array()

                    # 转换为PIL图像
                    img = Image.fromarray(img_array)
                    img = img.convert('L')
                    img = img.point(lambda x: 0 if x < 128 else 255, '1')

                    # 调整大小以提高OCR准确率
                    img = img.resize((100, 100), Image.LANCZOS)

                    # 保存临时图片用于OCR
                    buf = BytesIO()
                    img.save(buf, format='PNG')
                    img_bytes = buf.getvalue()

                    # OCR识别
                    result = self.ocr.classification(img_bytes)
                    if result and len(result) == 1:
                        # 建立两种映射：Unicode编码和字体编码
                        font_map[f'&#{char_code};'] = result
                        font_map[chr(char_code)] = result

                    if save_images:
                        img.save(f"{temp_dir}/{glyph_name}_{result}.png")

                except Exception as e:
                    continue

        except Exception as e:
            print(f"[!] OCR字体识别失败: {e}")

        return font_map

    def decrypt_content(self, content: str, font_map: Dict[str, str]) -> str:
        """使用字体映射解密内容"""
        if not font_map:
            return content

        # 按长度从长到短排序，避免部分匹配问题
        sorted_keys = sorted(font_map.keys(), key=len, reverse=True)
        for key in sorted_keys:
            content = content.replace(key, font_map[key])

        return content


class JSDecryptor:
    """JavaScript加密解密器"""

    def __init__(self):
        self.ctx_cache = {}

    def load_js(self, js_code: str, ctx_name: str = "default") -> bool:
        """加载并编译JS代码"""
        if not EXECJS_AVAILABLE:
            print("[!] PyExecJS未安装，无法执行JS解密")
            return False

        try:
            # 添加必要的环境模拟
            js_wrapper = """
            const window = globalThis;
            const document = {
                createElement: () => ({ getContext: () => ({ fillText: () => {}, measureText: () => ({ width: 0 }) }) }),
                getElementById: () => null,
                cookie: ''
            };
            const navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
            const location = { href: '', hostname: '' };

            %s
            """ % js_code

            ctx = execjs.compile(js_wrapper)
            self.ctx_cache[ctx_name] = ctx
            return True
        except Exception as e:
            print(f"[!] JS代码加载失败: {e}")
            return False

    def decrypt(self, encrypted: str, func_name: str, ctx_name: str = "default", *args) -> Optional[str]:
        """调用JS函数解密"""
        if ctx_name not in self.ctx_cache:
            return None

        try:
            ctx = self.ctx_cache[ctx_name]
            result = ctx.call(func_name, encrypted, *args)
            return result
        except Exception as e:
            print(f"[!] JS解密失败: {e}")
            return None

    @staticmethod
    def extract_js_from_html(html: str) -> list:
        """从HTML中提取内联JS代码"""
        script_pattern = re.compile(r'<script[^>]*>(.*?)</script>', re.DOTALL | re.IGNORECASE)
        scripts = script_pattern.findall(html)
        return [s.strip() for s in scripts if s.strip() and not s.strip().startswith('http')]

    @staticmethod
    def detect_aes_key(js_code: str) -> Optional[str]:
        """从JS代码中检测AES密钥"""
        # 常见的AES密钥模式
        key_patterns = [
            r'key\s*[:=]\s*["\']([^"\']{16,32})["\']',
            r'secret[key]?\s*[:=]\s*["\']([^"\']{16,32})["\']',
            r'decrypt.*?["\']([^"\']{16,32})["\']',
            r'CryptoJS\.AES\.decrypt\s*\(.*?["\']([^"\']{16,32})["\']',
        ]

        for pattern in key_patterns:
            matches = re.findall(pattern, js_code, re.IGNORECASE)
            if matches:
                return matches[0]
        return None


class AESDecryptor:
    """AES加密解密器"""

    @staticmethod
    def decrypt(encrypted_text: str, key: str, mode: str = 'ECB', iv: str = None,
                key_format: str = 'utf-8', output_format: str = 'utf-8') -> Optional[str]:
        """
        AES解密
        :param encrypted_text: 加密的文本（Base64编码）
        :param key: 密钥
        :param mode: ECB/CBC
        :param iv: 初始向量（CBC模式需要）
        :param key_format: 密钥格式
        :param output_format: 输出格式
        """
        if not CRYPTO_AVAILABLE:
            print("[!] pycryptodome未安装，无法进行AES解密")
            return None

        try:
            # 处理密钥
            if key_format == 'utf-8':
                key_bytes = key.encode('utf-8')
                # 处理密钥长度（AES要求16/24/32字节）
                if len(key_bytes) <= 16:
                    key_bytes = key_bytes.ljust(16, b'\0')
                elif len(key_bytes) <= 24:
                    key_bytes = key_bytes.ljust(24, b'\0')
                else:
                    key_bytes = key_bytes.ljust(32, b'\0')
            else:
                key_bytes = key

            # 解码Base64
            encrypted_bytes = base64.b64decode(encrypted_text)

            # 选择模式
            if mode.upper() == 'ECB':
                cipher = AES.new(key_bytes, AES.MODE_ECB)
            elif mode.upper() == 'CBC':
                if iv is None:
                    iv = key_bytes[:16]
                elif isinstance(iv, str):
                    iv = iv.encode('utf-8').ljust(16, b'\0')
                cipher = AES.new(key_bytes, AES.MODE_CBC, iv=iv)
            else:
                print(f"[!] 不支持的AES模式: {mode}")
                return None

            # 解密
            decrypted_bytes = cipher.decrypt(encrypted_bytes)
            decrypted_bytes = unpad(decrypted_bytes, AES.block_size)

            return decrypted_bytes.decode(output_format, errors='ignore')

        except Exception as e:
            print(f"[!] AES解密失败: {e}")
            return None

    @staticmethod
    def decrypt_auto(encrypted_text: str, keys: list = None) -> Optional[str]:
        """自动尝试常见密钥解密"""
        if keys is None:
            keys = [
                '1234567890abcdef',
                'abcdefghijklmnop',
                '0123456789abcdef',
                '16kclubreadebook',
                'novelcontentkey',
                'defaultsecretkey',
            ]

        for key in keys:
            for mode in ['ECB', 'CBC']:
                result = AESDecryptor.decrypt(encrypted_text, key, mode)
                if result and len(result) > 10 and not any(ord(c) < 32 for c in result[:10]):
                    return result
        return None


class ContentDecryptor:
    """通用内容解密器 - 整合多种解密方式"""

    def __init__(self):
        self.font_decryptor = FontDecryptor()
        self.js_decryptor = JSDecryptor()
        self.font_maps = {}

    def clean_html_tags(self, content: str) -> str:
        """清理HTML标签和广告"""
        # 移除script和style标签
        content = re.sub(r'<script.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(r'<style.*?</style>', '', content, flags=re.DOTALL | re.IGNORECASE)
        # 移除HTML标签
        content = re.sub(r'<br\s*/?>', '\n', content, flags=re.IGNORECASE)
        content = re.sub(r'<p\s*/?>', '\n', content, flags=re.IGNORECASE)
        content = re.sub(r'</p>', '\n', content, flags=re.IGNORECASE)
        content = re.sub(r'<[^>]+>', '', content)
        # 移除广告文本
        ad_patterns = [
            r'笔趣阁.*?最新章节',
            r'记住本站.*',
            r'手机用户.*',
            r'本章未完.*',
            r'请记住本书首发域名.*',
        ]
        for pattern in ad_patterns:
            content = re.sub(pattern, '', content, flags=re.IGNORECASE)

        # HTML实体解码
        entities = {
            '&nbsp;': ' ', '&lt;': '<', '&gt;': '>',
            '&amp;': '&', '&quot;': '"', '&apos;': "'",
            '&#39;': "'", '&ldquo;': '"', '&rdquo;': '"',
            '&lsquo;': "'", '&rsquo;': "'", '&hellip;': '…',
            '&mdash;': '—', '&ndash;': '–',
        }
        for entity, char in entities.items():
            content = content.replace(entity, char)

        # 清理空白
        content = re.sub(r'\n\s*\n', '\n', content)
        content = content.strip()

        return content

    def replace_chars(self, content: str, char_map: Dict[str, str] = None) -> str:
        """字符映射替换（处理错字替换类反爬）"""
        if char_map is None:
            # 常见的错字替换映射（需要根据具体网站调整）
            char_map = {}

        for old, new in char_map.items():
            content = content.replace(old, new)
        return content

    def detect_encryption(self, html: str) -> dict:
        """自动检测页面使用的加密方式"""
        encryption = {
            'font': False,
            'js': False,
            'aes': False,
            'base64': False,
            'css_before': False,
            'char_replace': False,
            'font_urls': [],
            'js_codes': [],
        }

        # 检测字体加密
        font_patterns = [
            r'@font-face\s*\{[^}]*font-family:\s*["\']?([^"\';\s]+)',
            r'url\(["\']?([^"\']+\.(?:woff2?|ttf|otf|eot))',
        ]
        for pattern in font_patterns:
            matches = re.findall(pattern, html, re.IGNORECASE)
            if matches:
                encryption['font'] = True
                encryption['font_urls'].extend(matches if isinstance(matches[0], str) else [m[-1] for m in matches])

        # 检测CSS ::before伪元素
        if re.search(r'::?before\s*\{[^}]*content\s*:', html):
            encryption['css_before'] = True

        # 检测JS加密
        js_codes = JSDecryptor.extract_js_from_html(html)
        for js in js_codes:
            if any(keyword in js.lower() for keyword in ['encrypt', 'decrypt', 'aes', 'base64', 'crypto']):
                encryption['js'] = True
                encryption['js_codes'].append(js)

        # 检测AES特征
        if re.search(r'CryptoJS\.AES|AES\.decrypt|aes-128|aes-256', html, re.IGNORECASE):
            encryption['aes'] = True

        return encryption

    def decrypt_chapter_content(self, content_html: str, encryption_info: dict = None,
                                 session=None, base_url: str = "", headers: dict = None) -> str:
        """解密章节内容，自动处理各类加密"""

        # 提取CSS中的伪元素内容
        if encryption_info and encryption_info.get('css_before'):
            css_styles = re.findall(r'<style.*?>(.*?)</style>', content_html, re.DOTALL | re.IGNORECASE)
            css_map = {}
            for style in css_styles:
                before_matches = re.findall(r'\.([a-zA-Z0-9_-]+)::?before\s*\{[^}]*content\s*:\s*["\']([^"\']*)["\']', style)
                for class_name, text in before_matches:
                    css_map[class_name] = text

            # 替换span标签
            def replace_span(match):
                class_match = re.search(r'class=["\']([^"\']+)["\']', match.group(0))
                if class_match:
                    classes = class_match.group(1).split()
                    for cls in classes:
                        if cls in css_map:
                            return css_map[cls]
                return ''

            content_html = re.sub(r'<span[^>]*></span>', replace_span, content_html)

        # 处理字体加密
        if encryption_info and encryption_info.get('font') and session:
            for font_url in encryption_info.get('font_urls', []):
                if not font_url.startswith('http'):
                    font_url = base_url.rstrip('/') + '/' + font_url.lstrip('/')
                font = self.font_decryptor.download_font(font_url, session, headers)
                if font:
                    font_map = self.font_decryptor.build_font_map_ocr(font)
                    content_html = self.font_decryptor.decrypt_content(content_html, font_map)

        # 清理HTML标签
        content = self.clean_html_tags(content_html)

        # 尝试Base64解码（如果内容看起来像Base64）
        if len(content) > 100 and re.match(r'^[A-Za-z0-9+/=]+$', content[:100]):
            try:
                decoded = base64.b64decode(content).decode('utf-8', errors='ignore')
                if len(decoded) > 50 and any('\u4e00' <= c <= '\u9fff' for c in decoded[:100]):
                    content = decoded
            except:
                pass

        return content


if __name__ == "__main__":
    print("[*] 解密模块加载成功")
    print("[*] 支持解密方式：")
    print("    - 字体加密（woff/ttf/otf，支持OCR自动识别）")
    print("    - JavaScript加密（AES/Base64/自定义加密）")
    print("    - AES加密（ECB/CBC模式）")
    print("    - CSS ::before伪元素内容")
    print("    - 字符替换/错字混淆")
    print("    - Base64编码内容")
