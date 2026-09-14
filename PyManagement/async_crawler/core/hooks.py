# core/hooks.py
from typing import Dict, Any
from core.task_model import CrawlTask

class BaseHook:
    async def before_request(self, task: CrawlTask, headers: Dict[str, str]) -> Dict[str, str]:
        """请求前钩子：修改header、cookie、计算签名，逆向JS签名放在这里"""
        return headers

    async def after_response(self, task: CrawlTask, resp_bytes: bytes) -> bytes:
        """响应后钩子：解密返回密文、base64解码、wasm解密，在这里写逆向逻辑"""
        return resp_bytes
