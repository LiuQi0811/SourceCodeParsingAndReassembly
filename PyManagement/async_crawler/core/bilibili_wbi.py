# core/bilibili_wbi.py
"""B 站 WBI 签名算法

WBI 是 B 站 web 端部分 API 的反爬签名机制,用于校验请求参数未被篡改。
本模块实现该签名生成,用于调用 /x/web-interface/wbi/view 等带 wbi 前缀的接口。

算法来源:
- B 站公开 API 文档 SocialSisterYi/bilibili-API-collect
- 开源实现 bilibili-api-python 等项目
WBI 签名本身是公开算法,不含任何凭据;登录态仍需用户自己提供 SESSDATA。

注意:
- 仅用于下载用户自己有权访问的内容(自己上传/已购买/公开免费视频)
- 遵守平台服务条款,不要用于批量爬取或规避付费访问
"""
import time
import hashlib
from typing import Dict, Tuple
from urllib.parse import urlencode
import aiohttp


# mixin key 打乱表(64 个下标,固定值,来自 B 站前端 wbi.js)
MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
    27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
    37, 36, 25, 65, 4, 26, 16, 0, 44, 17, 54, 7, 55, 24, 34, 30,
    6, 51, 1, 40, 22, 57, 48, 21, 20, 63, 11, 52, 56, 62, 60, 61
]


def get_mixin_key(orig: str) -> str:
    """用打乱表重组原 key,取前 32 字符作为 mixin_key

    注意:打乱表中含 65 等越界索引(JS 中越界返回 undefined 被拼接,Python 会 IndexError)。
    实际 [:32] 切片前 32 项里不含越界索引(最大 58),跳过越界项不影响最终 mixin_key。
    """
    parts = []
    for i in MIXIN_KEY_ENC_TAB:
        if i < len(orig):
            parts.append(orig[i])
    return ''.join(parts)[:32]


def _sanitize_value(v: str) -> str:
    """过滤参数值中的特殊字符(B 站签名规则)"""
    return ''.join(
        c for c in v if c not in "!'()*-_."
    ) if isinstance(v, str) else str(v)


def wbi_sign(params: Dict, img_key: str, sub_key: str) -> Dict:
    """对参数字典做 WBI 签名,返回带 wts 和 w_rid 的新字典"""
    mixin_key = get_mixin_key(img_key + sub_key)
    params = dict(params)
    # wts 是当前秒级时间戳
    params['wts'] = round(time.time())
    # 按 key 字典序排序
    params = dict(sorted(params.items()))
    # 过滤值的特殊字符
    params = {k: _sanitize_value(str(v)) for k, v in params.items()}
    # 拼接查询串(urlencode 已按 key 排序)
    query = urlencode(params)
    w_rid = hashlib.md5((query + mixin_key).encode()).hexdigest()
    params['w_rid'] = w_rid
    return params


async def fetch_wbi_keys(session: aiohttp.ClientSession, headers: dict = None) -> Tuple[str, str]:
    """从 nav API 拿 img_url 和 sub_url,提取 img_key 和 sub_key

    nav API 不需要 WBI 签名,直接调用即可。
    :return: (img_key, sub_key)
    """
    headers = headers or {}
    async with session.get(
        'https://api.bilibili.com/x/web-interface/nav',
        headers=headers
    ) as resp:
        if resp.status != 200:
            raise Exception(f"nav API HTTP {resp.status}")
        data = await resp.json()
    if data.get('code') != 0:
        raise Exception(f"nav API 错误: {data.get('message')}")
    wbi_img = data['data']['wbi_img']
    img_url = wbi_img['img_url']
    sub_url = wbi_img['sub_url']
    # 提取文件名(去掉扩展名)作为 key
    img_key = img_url.rsplit('/', 1)[-1].split('.')[0]
    sub_key = sub_url.rsplit('/', 1)[-1].split('.')[0]
    return img_key, sub_key
