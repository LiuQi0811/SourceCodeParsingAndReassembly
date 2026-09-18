"""SpiderBuf 39 关任务定义（challenges）。

三种解题路径：
1. 直抓：纯 GET/POST + 解析器（s01/s02/s03/s05/s07/s08/e04/n01）
2. solver：两步请求/签名（s04/s06/e01/n03/c01/c03/c06/c07/c08/c09/c10/c11/h05/h06）
3. external：复用现有 spiders/ 实测脚本（e02/e03/n02/n04/n05/n06/n07/
   h01/h02/h03/h04/c02/c04/c05/c12/c13/c14 —— 浏览器指纹/OCR/JS 求值/复杂解析）

URL 与解法均取自 spiders/ 目录中已实测通过的脚本，保持一致。
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from core.factories import TaskFactory
from core.models import Task

# 旧项目 spiderbuf_crawler 与本项目同级（PyManagement/D/ 下）：
# challenges.py → spiderbuf/ → sites/ → spiderbuf_async_crawler/ → 上级目录
_SPIDERS_DIR = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "spiderbuf_crawler" / "spiders")
# 允许用环境变量覆盖（换机器时免改代码）
SPIDERS_DIR = os.environ.get("SPIDERBUF_SPIDERS_DIR") or str(_SPIDERS_DIR)
if not os.path.isdir(SPIDERS_DIR):
    SPIDERS_DIR = ""

# e02 需要 Python 3.12 + ddddocr（验证码 OCR）；可用环境变量覆盖
PY312 = os.environ.get("SPIDERBUF_PY312") or r"E:\Program Files\Python312\python.exe"


def _ext(code: str) -> str:
    """外部脚本绝对路径（找不到旧项目时给出明确错误）。"""
    if not SPIDERS_DIR:
        raise RuntimeError(
            "未找到 spiderbuf_crawler/spiders 目录，请设置环境变量 "
            "SPIDERBUF_SPIDERS_DIR 指向旧项目 spiders 目录")
    return os.path.join(SPIDERS_DIR, f"spider_{code}.py")


_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) "
                   "Chrome/126.0.0.0 Safari/537.36"),
    "Accept-Language": "zh-CN,zh;q=0.9",
}

# 每关定义：(code, url, overrides)
# overrides 支持：method/data/headers/parser/solver/pages/external_script/
#                require_browser/extra/save_resources/save_html
CHALLENGES: List[Dict[str, Any]] = [
    # ---------------- 入门组 s01-s08 ----------------
    {"code": "s01", "url": "https://spiderbuf.cn/challenge/requests-lxml-for-scraping-beginner",
     "parser": "bs4", "headers": _HEADERS},
    {"code": "s02", "url": "https://spiderbuf.cn/challenge/scraper-http-header",
     "parser": "bs4", "headers": _HEADERS},
    {"code": "s03", "url": "https://spiderbuf.cn/challenge/lxml-xpath-advanced",
     "parser": "bs4", "headers": _HEADERS},
    {"code": "s04", "url": "https://spiderbuf.cn/challenge/web-pagination-scraper",
     "parser": "bs4", "headers": _HEADERS, "solver": "s04", "pages": 5},
    {"code": "s05", "url": "https://spiderbuf.cn/challenge/scraping-images-from-web",
     "parser": "bs4", "headers": _HEADERS,
     # 纯图片关：data 为空属正常，跳过数据校验（资源下载为成功标准）
     "extra": {"expect": False}},
    {"code": "s06", "url": "https://spiderbuf.cn/challenge/scraping-iframe",
     "parser": "bs4", "headers": _HEADERS, "solver": "s06"},
    {"code": "s07", "url": "https://spiderbuf.cn/challenge/iplist",
     "parser": "bs4", "headers": {**_HEADERS, "Referer": "https://spiderbuf.cn/challenge/scraping-ajax-api"}},
    {"code": "s08", "url": "https://spiderbuf.cn/challenge/scraper-via-http-post",
     "parser": "bs4", "headers": _HEADERS, "method": "POST",
     "data": {"level": "8"}},

    # ---------------- 登录/代理组 e01-e04 ----------------
    {"code": "e01", "url": "https://spiderbuf.cn/challenge/scraper-login-username-password",
     "parser": "bs4", "headers": _HEADERS, "solver": "e01",
     # 登录接口对并发敏感：错峰 0.8s 降低全量时偶发失败
     "extra": {"pre_delay": 0.8}},
    {"code": "e02", "url": "https://spiderbuf.cn/challenge/web-scraping-with-captcha",
     "external_script": _ext("e02"), "require_browser": True,
     "extra": {"python": PY312}},
    {"code": "e03", "url": "https://spiderbuf.cn/challenge/scraping-random-pagination",
     "external_script": _ext("e03"), "require_browser": True},
    {"code": "e04", "url": "https://spiderbuf.cn/challenge/block-ip-proxy",
     "parser": "bs4", "headers": _HEADERS},

    # ---------------- 进阶组 n01-n07 ----------------
    {"code": "n01", "url": "https://spiderbuf.cn/challenge/user-agent-referrer",
     "parser": "bs4", "parser_config": {"list_selectors": {"公司": "h2"}},
     "headers": {**_HEADERS, "Referer": "https://spiderbuf.cn/challenges"}},
    {"code": "n02", "url": "https://spiderbuf.cn/challenge/scraping-images-base64",
     "external_script": _ext("n02"), "require_browser": True},
    {"code": "n03", "url": "https://spiderbuf.cn/challenge/scraper-bypass-request-limit",
     "parser": "bs4", "headers": _HEADERS, "solver": "n03", "pages": 20},
    {"code": "n04", "url": "https://spiderbuf.cn/challenge/css-pseudo-elements",
     "external_script": _ext("n04"), "require_browser": True},
    {"code": "n05", "url": "https://spiderbuf.cn/challenge/css-sprites",
     "external_script": _ext("n05"), "require_browser": True},
    {"code": "n06", "url": "https://spiderbuf.cn/challenge/scraping-form-rpa",
     "external_script": _ext("n06"), "require_browser": True},
    {"code": "n07", "url": "https://spiderbuf.cn/challenge/random-css-classname",
     "external_script": _ext("n07"), "require_browser": True},

    # ---------------- JS 逆向组 h01-h06 ----------------
    {"code": "h01", "url": "https://spiderbuf.cn/challenge/scraping-css-confuse-offset",
     "external_script": _ext("h01"), "require_browser": True},
    {"code": "h02", "url": "https://spiderbuf.cn/challenge/scraping-douban-movies-xpath-advanced",
     "external_script": _ext("h02"), "require_browser": True},
    {"code": "h03", "url": "https://spiderbuf.cn/challenge/scraping-scroll-load",
     "external_script": _ext("h03"), "require_browser": True},
    {"code": "h04", "url": "https://spiderbuf.cn/static/js/udSL29.min.js",
     "external_script": _ext("h04"), "require_browser": True},
    {"code": "h05", "url": "https://spiderbuf.cn/challenge/javascript-reverse-timestamp/api/",
     "parser": "re", "headers": _HEADERS, "solver": "h05"},
    {"code": "h06", "url": "https://spiderbuf.cn/challenge/selenium-fingerprint-anti-scraper/api/",
     "parser": "re", "headers": _HEADERS, "solver": "h05"},

    # ---------------- 高级组 c01-c07 ----------------
    {"code": "c01", "url": "https://spiderbuf.cn/challenge/scraper-practice-c01",
     "parser": "bs4", "headers": _HEADERS, "solver": "c01"},
    {"code": "c02", "url": "https://spiderbuf.cn/challenge/scraper-practice-c02",
     "external_script": _ext("c02"), "require_browser": True},
    {"code": "c03", "url": "https://spiderbuf.cn/challenge/scraper-practice-c03",
     "parser": "re", "headers": _HEADERS, "solver": "c03", "pages": 5},
    {"code": "c04", "url": "https://spiderbuf.cn/challenge/scraper-practice-c04",
     "external_script": _ext("c04"), "require_browser": True},
    {"code": "c05", "url": "https://spiderbuf.cn/challenge/scraper-practice-c05",
     "external_script": _ext("c05"), "require_browser": True},
    {"code": "c06", "url": "https://spiderbuf.cn/challenge/scraper-practice-c06",
     "parser": "re", "headers": _HEADERS, "solver": "c06"},
    {"code": "c07", "url": "https://spiderbuf.cn/challenge/scraper-practice-c07",
     "parser": "re", "headers": _HEADERS, "solver": "c07",
     # 服务端对并发请求限流较严：优先级最低（全量最后跑）+ 错峰 + 更长重试窗口
     "priority": -1,
     "extra": {"max_retries": 4, "retry_backoff": 2.0, "pre_delay": 1.5}},

    # ---------------- 专家组 c08-c14 ----------------
    {"code": "c08", "url": "https://spiderbuf.cn/challenge/scraper-practice-c08",
     "external_script": _ext("c08"), "require_browser": True},
    {"code": "c09", "url": "https://spiderbuf.cn/challenge/scraper-practice-c09",
     "external_script": _ext("c09"), "require_browser": True},
    {"code": "c10", "url": "https://spiderbuf.cn/challenge/scraper-practice-js-reverse-c10",
     "parser": "bs4", "headers": _HEADERS, "solver": "c10",
     # 同 c07：JS 反爬路径限流窗口较长，最后跑 + 错峰
     "priority": -1, "extra": {"pre_delay": 1.5}},
    {"code": "c11", "url": "https://spiderbuf.cn/challenge/scraper-practice-js-reverse-c11",
     "parser": "re", "headers": _HEADERS, "solver": "c11"},
    {"code": "c12", "url": "https://spiderbuf.cn/challenge/web-scraping-practice-js-reverse-c12",
     "external_script": _ext("c12"), "require_browser": True},
    {"code": "c13", "url": "https://spiderbuf.cn/challenge/web-scraping-practice-c13",
     "external_script": _ext("c13"), "require_browser": True},
    {"code": "c14", "url": "https://spiderbuf.cn/challenge/anti-simulate-web-browser",
     "external_script": _ext("c14"), "require_browser": True},
]


def build_tasks(groups: Optional[List[str]] = None,
                codes: Optional[List[str]] = None,
                solver_registry: Optional[dict] = None) -> List[Task]:
    """展开 39 关任务定义 → Task 列表。

    - groups: 按系列筛选，如 ["s", "e", "n", "h", "c"]（默认全部）
    - codes: 精确关卡码筛选，如 ["s01", "c03"]
    """
    tasks: List[Task] = []
    for spec in CHALLENGES:
        code = spec["code"]
        if codes and code not in codes:
            continue
        if groups and code[0] not in groups:
            continue
        pages = spec.get("pages", 1)
        base = {k: v for k, v in spec.items() if k not in ("code", "pages")}
        for page in range(1, pages + 1):
            task_spec = dict(base)
            task_spec["title"] = f"spiderbuf-{code}" + (f"-p{page}" if pages > 1 else "")
            if pages > 1:
                task_spec["extra"] = {**base.get("extra", {}), "page": page}
            tasks.append(TaskFactory.create(task_spec))
    return tasks
