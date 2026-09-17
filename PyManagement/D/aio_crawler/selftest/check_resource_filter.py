# -*- coding: utf-8 -*-
"""验证 --resources / --accept-exts 参数解析与过滤行为（进程内服务器）。

运行：python selftest/check_resource_filter.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

SELF = Path(__file__).resolve().parent
ROOT = SELF.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(SELF) not in sys.path:
    sys.path.insert(0, str(SELF))

from aio_crawler.config import Config
from aio_crawler.engine import CrawlEngine
from run_selftest import make_server


def check_cfg() -> bool:
    ok = True
    c1 = Config.from_cli(["http://x/", "--resources", "image,video"])
    ok &= c1.resource_types == {"image", "video"}
    print("resource_types:", c1.resource_types, "OK" if c1.resource_types == {"image", "video"} else "FAIL")

    c2 = Config.from_cli(["http://x/", "--accept-exts", "png,MP4, .m3u8"])
    ok &= c2.accept_exts == {"png", "mp4", "m3u8"}
    print("accept_exts:", c2.accept_exts, "OK" if c2.accept_exts == {"png", "mp4", "m3u8"} else "FAIL")

    try:
        Config.from_cli(["http://x/", "--resources", "video,xxx"])
        ok &= False
        print("invalid category: FAIL(未报错)")
    except SystemExit:
        print("invalid category: OK(正确报错退出)")
    return ok


async def check_behavior(base: str) -> bool:
    # 首页资源：logo.png(image) + sample.pdf(doc)，全类型应发现 2 个
    c_default = Config(start_urls=[base], max_pages=1, download_resources=False,
                       save_root=str(SELF / "tmp_f"))
    s_default = await CrawlEngine(c_default).run()

    c_img = Config(start_urls=[base], max_pages=1, download_resources=False,
                   resource_types={"image"}, save_root=str(SELF / "tmp_f"))
    s_img = await CrawlEngine(c_img).run()

    c_png = Config(start_urls=[base], max_pages=1, download_resources=False,
                   accept_exts={"png"}, save_root=str(SELF / "tmp_f"))
    s_png = await CrawlEngine(c_png).run()

    ok = True
    ok &= s_default["resources_found"] == 2
    print(f"默认(全类型): resources_found={s_default['resources_found']} (期望2)",
          "OK" if s_default["resources_found"] == 2 else "FAIL")
    ok &= s_img["resources_found"] == 1
    print(f"--resources image: resources_found={s_img['resources_found']} (期望1)",
          "OK" if s_img["resources_found"] == 1 else "FAIL")
    ok &= s_png["resources_found"] == 1
    print(f"--accept-exts png: resources_found={s_png['resources_found']} (期望1)",
          "OK" if s_png["resources_found"] == 1 else "FAIL")
    return ok


async def main() -> int:
    print("== 1) 参数解析 ==")
    ok1 = check_cfg()
    runner, base = await make_server()
    try:
        print("\n== 2) 过滤行为（进程内服务器）==")
        ok2 = await check_behavior(base)
    finally:
        await runner.cleanup()
    print("\nRESULT:", "ALL OK" if (ok1 and ok2) else "SOME FAILED")
    return 0 if (ok1 and ok2) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
