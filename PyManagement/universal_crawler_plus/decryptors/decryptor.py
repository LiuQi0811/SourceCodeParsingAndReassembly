"""
逆向解密模块
提供通用的加解密、JS混淆还原、响应内容解密框架
设计模式：责任链模式 + 策略模式
"""
import re
import base64
import gzip
import zlib
import brotli
import hashlib
import json
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List, Callable
from urllib.parse import unquote

from utils.logger import get_logger

logger = get_logger("Decryptor")


try:
    from Crypto.Cipher import AES, DES, DES3
    from Crypto.Util.Padding import pad, unpad
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False
    logger.warning("pycryptodome未安装，对称加密解密功能不可用")

try:
    import execjs
    HAS_EXECJS = True
except ImportError:
    HAS_EXECJS = False
    logger.warning("PyExecJS未安装，JS执行功能不可用")


class DecryptHandler(ABC):
    """解密处理器抽象基类"""
    @abstractmethod
    def can_handle(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bool:
        """判断是否能处理该内容"""
        pass

    @abstractmethod
    def decrypt(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bytes:
        """执行解密"""
        pass


class GzipDecryptor(DecryptHandler):
    """Gzip解压处理器"""
    def can_handle(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bool:
        ce = headers.get("Content-Encoding", "").lower()
        return "gzip" in ce

    def decrypt(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bytes:
        try:
            return gzip.decompress(content)
        except Exception as e:
            logger.warning(f"Gzip解压失败: {e}")
            return content


class DeflateDecryptor(DecryptHandler):
    """Deflate解压处理器"""
    def can_handle(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bool:
        ce = headers.get("Content-Encoding", "").lower()
        return "deflate" in ce

    def decrypt(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bytes:
        try:
            return zlib.decompress(content)
        except Exception as e:
            logger.warning(f"Deflate解压失败: {e}")
            return content


class BrotliDecryptor(DecryptHandler):
    """Brotli解压处理器"""
    def can_handle(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bool:
        ce = headers.get("Content-Encoding", "").lower()
        return "br" in ce

    def decrypt(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bytes:
        try:
            return brotli.decompress(content)
        except Exception as e:
            logger.warning(f"Brotli解压失败: {e}")
            return content


class Base64Decryptor(DecryptHandler):
    """Base64解码处理器（自动识别内容是否为Base64编码的JSON/HTML）"""
    def can_handle(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bool:
        try:
            text = content.decode("utf-8", errors="ignore").strip()
            # 匹配纯base64特征
            if re.match(r'^[A-Za-z0-9+/=]{100,}$', text):
                decoded = base64.b64decode(text)
                # 解码后是否是可读文本
                try:
                    decoded_text = decoded.decode("utf-8")
                    return decoded_text.startswith(("<", "{", "[")) or "<html" in decoded_text.lower()
                except Exception:
                    return False
        except Exception:
            pass
        return False

    def decrypt(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bytes:
        try:
            text = content.decode("utf-8").strip()
            return base64.b64decode(text)
        except Exception as e:
            logger.warning(f"Base64解码失败: {e}")
            return content


class AESDecryptor(DecryptHandler):
    """AES解密处理器 - 通过context传递key/iv/mode"""
    def can_handle(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bool:
        return context.get("aes_key") is not None and HAS_CRYPTO

    def decrypt(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bytes:
        try:
            key = context["aes_key"].encode() if isinstance(context["aes_key"], str) else context["aes_key"]
            iv = context.get("aes_iv", b"")
            if isinstance(iv, str):
                iv = iv.encode()
            mode = context.get("aes_mode", AES.MODE_CBC)
            cipher = AES.new(key, mode, iv=iv if iv else None)
            decrypted = cipher.decrypt(content)
            try:
                decrypted = unpad(decrypted, AES.block_size)
            except Exception:
                pass
            return decrypted
        except Exception as e:
            logger.warning(f"AES解密失败: {e}")
            return content


class JSObfuscationDecryptor(DecryptHandler):
    """JS混淆还原处理器 - 执行JS获取真实内容"""
    def can_handle(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bool:
        return context.get("js_code") is not None and HAS_EXECJS

    def decrypt(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bytes:
        try:
            js_code = context["js_code"]
            call_expr = context.get("js_call", "result")
            ctx = execjs.compile(js_code)
            result = ctx.eval(call_expr)
            if isinstance(result, str):
                return result.encode("utf-8")
            return str(result).encode("utf-8")
        except Exception as e:
            logger.warning(f"JS执行解密失败: {e}")
            return content


class CommonObfuscationDecryptor(DecryptHandler):
    """常见简单混淆处理器：URL编码、HTML实体编码、Unicode转义"""
    def can_handle(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bool:
        try:
            text = content.decode("utf-8", errors="ignore")
            # 检测大量HTML实体或Unicode转义
            entity_count = len(re.findall(r'&#x?[0-9a-fA-F]+;|\\u[0-9a-fA-F]{4}|%[0-9A-Fa-f]{2}', text))
            return entity_count > len(text) * 0.3
        except Exception:
            return False

    def decrypt(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any]) -> bytes:
        import html
        text = content.decode("utf-8", errors="ignore")
        # URL解码
        text = unquote(text)
        # HTML实体解码
        text = html.unescape(text)
        # Unicode转义解码
        text = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), text)
        return text.encode("utf-8")


class DecryptChain:
    """解密责任链"""
    def __init__(self):
        self._handlers: List[DecryptHandler] = [
            GzipDecryptor(),
            DeflateDecryptor(),
            BrotliDecryptor(),
            CommonObfuscationDecryptor(),
            Base64Decryptor(),
            AESDecryptor(),
            JSObfuscationDecryptor(),
        ]
        self._custom_handlers: List[DecryptHandler] = []

    def add_handler(self, handler: DecryptHandler):
        """添加自定义解密处理器"""
        self._custom_handlers.append(handler)

    def decrypt(self, content: bytes, headers: Dict[str, str], context: Dict[str, Any] = None) -> bytes:
        """按责任链依次尝试解密"""
        if context is None:
            context = {}
        result = content
        # 先执行自定义处理器
        for handler in self._custom_handlers + self._handlers:
            try:
                if handler.can_handle(result, headers, context):
                    logger.debug(f"使用 {handler.__class__.__name__} 处理内容")
                    result = handler.decrypt(result, headers, context)
            except Exception as e:
                logger.debug(f"处理器 {handler.__class__.__name__} 异常: {e}")
        return result


# 全局解密链实例
_decrypt_chain: Optional[DecryptChain] = None


def get_decrypt_chain() -> DecryptChain:
    global _decrypt_chain
    if _decrypt_chain is None:
        _decrypt_chain = DecryptChain()
    return _decrypt_chain


def register_decrypt_handler(handler: DecryptHandler):
    """注册自定义解密处理器"""
    get_decrypt_chain().add_handler(handler)
    logger.info(f"注册自定义解密处理器: {handler.__class__.__name__}")
