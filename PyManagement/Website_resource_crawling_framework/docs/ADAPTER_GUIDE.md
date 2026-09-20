# 视频站适配器扩展指南

本框架支持三类视频站抓取：

1. **MacCMS 明文站**（如 fdzys.com、ysxq.cc）：m3u8 明文写在 HTML 的 `player_aaaa` / `mac_player_info` 对象里，通用正则自动提取，无需适配器。
2. **加密 MacCMS 站**：`encrypt=0/1/2` 自动解密（明文 / URL 编码 / base64+URL 编码），也无需适配器。
3. **JS 动态渲染 / API 取流站**（如 xgcartoon）：m3u8 不在静态 HTML 里，需要调 API 或执行 JS 才能拿到——这类站**必须写适配器**。

---

## 一、目录结构

```
crawler_framework/adapters/
├── __init__.py       # 注册表 + get_adapter(url)
├── base.py           # VideoSiteAdapter 抽象基类
├── xgcartoon.py      # 西瓜卡通实现（示例）
└── <新站>.py         # 你新增的适配器放这里
```

---

## 二、扩展新站步骤

### Step 1：新建适配器文件

在 `crawler_framework/adapters/` 下新建 `mysite.py`：

```python
"""
我的视频站适配器
链路：播放页 URL → API → m3u8 直链
"""
import re
from typing import Optional
import aiohttp
from crawler_framework.adapters.base import VideoSiteAdapter
from crawler_framework.adapters import register_adapter


@register_adapter
class MySiteAdapter(VideoSiteAdapter):
    name = "mysite"   # 适配器名，用于日志

    @classmethod
    def match(cls, url: str) -> bool:
        # 判断此 URL 是否归本适配器管
        return "mysite.com/video/" in url

    async def extract_m3u8(
        self,
        url: str,
        session: aiohttp.ClientSession,
    ) -> Optional[str]:
        # 1. 从播放页 URL 提取关键参数（如 id / vid / chapter_id）
        m = re.search(r"/video/(\d+)\.html", url)
        if not m:
            return None
        video_id = m.group(1)

        # 2. 调该站的 API 拿播放地址（用传入的 session，复用连接池）
        api = f"https://mysite.com/api/play?id={video_id}"
        try:
            async with session.get(api, headers={"Referer": url},
                                   timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    return None
                data = await resp.json(content_type=None)
        except Exception:
            return None

        # 3. 从 API 返回里抠出 m3u8 直链
        m3u8 = (data or {}).get("url")
        if not m3u8:
            return None
        return m3u8
```

### Step 2：自动注册

`@register_adapter` 装饰器会自动把类加入注册表。
**不需要**改其他文件——`adapters/__init__.py` 末尾会自动 import 所有适配器模块。

> 注意：如果新文件没被 import，注册表就收不到。确保文件放在 `crawler_framework/adapters/` 下，且类上有 `@register_adapter`。

### Step 3：验证

```bash
python -c "import sys; sys.path.insert(0,'.'); \
from crawler_framework.adapters import list_adapters; \
print(list_adapters())"
# 应输出包含你的适配器名
```

写个临时脚本实测：

```python
import asyncio, aiohttp
from crawler_framework.adapters import get_adapter

async def test():
    url = "https://mysite.com/video/123.html"
    ad = get_adapter(url)
    print("matched:", ad.name if ad else None)
    async with aiohttp.ClientSession() as s:
        print("m3u8:", await ad.extract_m3u8(url, s))

asyncio.run(test())
```

### Step 4：跑全量测试

```bash
python -m unittest discover -s tests -p "test_*.py"
```

确保 75+ 测试全绿，没回归。

---

## 三、引擎自动接入流程

引擎不需要你改任何代码。它在解析完每个页面后会自动：

```
当前页面 URL
  ↓
get_adapter(url)  ← 遍历注册表，找 match() 返回 True 的适配器
  ↓
extract_m3u8(url, session)  ← 你的适配器实现
  ↓
m3u8 加入 resource_urls（category="videos"）
  ↓
on_m3u8_found 钩子自动触发 DownloadManager
  ↓
并发下载分片 → AES 解密 → 自动合并成单个 .ts
```

---

## 四、设计原则

| 原则 | 说明 |
|---|---|
| **match() 要精确** | 别用太宽的匹配（如只写 `".com" in url`），会抢其他站的流量。用域名 + 路径特征 |
| **extract_m3u8 要容错** | API 超时 / JSON 解析失败 / 字段缺失都返回 `None`，不要抛异常 |
| **用传入的 session** | 不要自己 `aiohttp.ClientSession()`，复用引擎的连接池和 UA |
| **Referer 要带** | 很多 CDN 校验 Referer，请求 API 和 m3u8 时都带上播放页 URL 做 Referer |
| **name 要唯一** | 用于日志和资源 alt 标记 |

---

## 五、已内置适配器

| 适配器 | 站点 | 链路 |
|---|---|---|
| `xgcartoon` | 西瓜卡通（cnxgct.com / xgcartoon.com） | 播放页 URL → `content_pframe_url` API 拿 vid → `bzcdn.net/{vid}/playlist.m3u8` |

---

## 六、什么时候不需要适配器

- m3u8 直接明文写在 HTML 里（`<video src="...m3u8">` 或 `"url":"...m3u8"`）→ 通用正则已覆盖
- encrypt=0/1/2 的 MacCMS 站 → 自动解密已覆盖
- 只有 m3u8 靠 JS 执行 / API 请求才能拿到时，才需要适配器
