"""命令行入口。

    python -m mharvest <网址> -o ./out --depth 2
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .crawler import ALL_KINDS, CrawlConfig, Crawler
from .hls import hls_variants
from .http import DEFAULT_UA, HttpClient
from .store import FileStore

KIND_CHOICES = sorted(ALL_KINDS)


def human_size(num: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if num < 1024 or unit == "GB":
            return f"{num:.1f} {unit}" if unit != "B" else f"{int(num)} B"
        num /= 1024
    return f"{num:.1f} GB"


def parse_kinds(text: str) -> set:
    wanted = {part.strip().lower() for part in text.split(",") if part.strip()}
    unknown = wanted - ALL_KINDS
    if unknown:
        raise argparse.ArgumentTypeError(
            f"未知类型 {unknown}，可选：{', '.join(KIND_CHOICES)}")
    return wanted


def parse_pairs(items: list[str]) -> dict:
    """把 ['a: 1', 'b: 2'] 或 ['a=1;b=2'] 解析成字典。"""
    out = {}
    for item in items or []:
        for chunk in item.split(";"):
            chunk = chunk.strip()
            if not chunk:
                continue
            sep = ":" if ":" in chunk else "="
            if sep not in chunk:
                continue
            key, value = chunk.split(sep, 1)
            out[key.strip()] = value.strip()
    return out


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="mharvest",
        description="输入一个网址，抓取站点的图片 / 视频 / 音频等资源",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例：
  python -m mharvest https://example.com
  python -m mharvest https://example.com -o ./out --depth 2 --kind image,video
  python -m mharvest https://site.com/page --min-size 20480   # 丢掉小于 20KB 的图
  python -m mharvest https://v.qq.com/x --hls 1080p --workers 16
  python -m mharvest https://site.com/live.m3u8 --list-variants
""")
    # nargs="?"：--check-blob 这种纯环境检查不需要给网址
    parser.add_argument("url", nargs="?", help="起始网址")
    parser.add_argument("-o", "--out", default="./downloads", help="输出目录（默认 ./downloads）")
    parser.add_argument("--depth", type=int, default=1, help="页面递归层数，默认 1（只抓入口页）")
    parser.add_argument("--max-pages", type=int, default=30, help="最多翻多少页，默认 30")
    parser.add_argument("--max-resources", type=int, default=0, help="最多抓多少资源，0 不限")
    parser.add_argument("--workers", type=int, default=8, help="下载并发数，默认 8")
    parser.add_argument("--kind", type=parse_kinds, default=set(ALL_KINDS),
                        help="只抓指定类型，逗号分隔：" + ",".join(KIND_CHOICES))
    parser.add_argument("--min-size", type=int, default=0, help="小于该字节数的资源丢弃（过滤占位图）")
    parser.add_argument("--max-size", type=int, default=0, help="大于该字节数的资源跳过，0 不限")
    parser.add_argument("--hls", default="best", metavar="POLICY",
                        help="m3u8 选流：best / worst / 720p，默认 best")
    parser.add_argument("--list-variants", action="store_true", help="只列出 m3u8 的码流，不下载")
    parser.add_argument("--all-domains", action="store_true", help="允许抓取其他域名的资源")
    parser.add_argument("--no-subdomains", action="store_true", help="翻页时严格限定同域，不含子域")
    parser.add_argument("--no-css", action="store_true", help="不解析 CSS 里的背景图/字体")
    parser.add_argument("--no-scripts", action="store_true", help="不扫 <script> 里的隐藏地址")
    parser.add_argument("--follow-iframes", action="store_true", help="把 iframe 当页面继续爬")
    parser.add_argument("--no-robots", action="store_true", help="不遵守 robots.txt")
    parser.add_argument("--no-ffmpeg", action="store_true", help="禁用 ffmpeg，只做裸拼接")
    parser.add_argument("--delay", type=float, default=0.0, help="同域名请求间隔秒数，默认 0")
    parser.add_argument("--timeout", type=float, default=30.0, help="读取超时秒数，默认 30")
    parser.add_argument("--retries", type=int, default=3, help="重试次数，默认 3")
    parser.add_argument("--proxy", help="代理，如 http://127.0.0.1:7890")
    parser.add_argument("--ua", help="自定义 User-Agent")
    parser.add_argument("--cookie", action="append", metavar="K=V", help="Cookie，可重复")
    parser.add_argument("--header", action="append", metavar="K: V", help="附加请求头，可重复")
    parser.add_argument("--manifest", help="结果清单 JSON 路径，默认 <输出目录>/manifest.json")
    parser.add_argument("-q", "--quiet", action="store_true", help="只打印摘要")

    # ts 合并
    parser.add_argument("--merge-ts", action="store_true",
                        help="抓取结束后，把散装的 ts 分片合并成完整视频")
    parser.add_argument("--merge-dir", metavar="DIR",
                        help="单独合并某个目录里的 ts（不抓取，只合并）")
    parser.add_argument("--delete-parts", action="store_true",
                        help="合并成功后删除原分片（默认保留）")
    parser.add_argument("--merge-min", type=int, default=2, metavar="N",
                        help="至少 N 个文件才算序列，默认 2")

    # blob / MSE：纯 HTTP 抓不到，需要真浏览器
    blob_group = parser.add_argument_group(
        "blob / MSE 视频（需要 Playwright，用于纯 HTTP 抓不到的播放器）")
    blob_group.add_argument("--browser", action="store_true",
                            help="启用浏览器后端抓 blob / MSE 视频")
    blob_group.add_argument("--click", metavar="SELECTOR",
                            help="需要点击才播放时的 CSS 选择器，如 '#play'")
    blob_group.add_argument("--wait", type=float, default=30.0,
                            help="等待视频数据加载的秒数，默认 30")
    blob_group.add_argument("--no-scroll", action="store_true",
                            help="不自动滚动页面（滚动用于触发懒加载）")
    blob_group.add_argument("--headed", action="store_true",
                            help="显示浏览器窗口，调试反爬时有用")
    blob_group.add_argument("--check-blob", action="store_true",
                            help="只检查 blob 抓取的环境是否就绪")
    return parser


def check_blob_env() -> int:
    """检查浏览器后端的前置条件。"""
    from .blob import check_environment

    env = check_environment()
    print("blob / MSE 抓取环境检查\n")

    marks = []
    marks.append(("Playwright", env["playwright"], "pip install playwright"))
    marks.append(("Chromium", env["chromium"],
                  "playwright install chromium"))
    marks.append(("ffmpeg", env["ffmpeg"],
                  "可选，仅 TS 分片转封装需要（fMP4 不需要）"))

    for name, ok, fix in marks:
        print(f"  [{'OK ' if ok else '缺少'}] {name:<12}"
              f"{'' if ok else '  -> ' + fix}")

    if env.get("chromium_error"):
        print(f"\n  Chromium 检测异常：{env['chromium_error']}")

    ready = env["playwright"] and env["chromium"]
    print("\n" + ("环境就绪，可以用 --browser 抓取。"
                  if ready else "环境未就绪，请按上面的提示安装。"))
    return 0 if ready else 1


def run_blob(args) -> int:
    """浏览器后端：抓 blob / MSE 视频。"""
    from .blob import BlobConfig, BlobHarvester

    env_ok = check_blob_env()
    if env_ok != 0:
        return 1

    config = BlobConfig(
        wait_seconds=args.wait,
        click_selector=args.click or "",
        scroll_to_bottom=not args.no_scroll,
        headless=not args.headed,
        proxy=args.proxy,
        user_agent=args.ua,
    )
    harvester = BlobHarvester(config, on_event=lambda event, payload: _blob_log(
        event, payload, args.quiet))

    print(f"\n目标：{args.url}")
    print(f"输出：{Path(args.out).resolve()}\n")

    result = harvester.harvest(args.url, args.out)

    print("\n" + "=" * 56)
    if result.ok:
        print(f"抓取成功")
        print(f"  文件：{result.path}")
        print(f"  分片：{result.chunks} 个，{human_size(result.size)}")
        print(f"  方式：{result.method}")
        print(f"  页面 video 元素：{result.video_count} 个")
    else:
        print("抓取失败")
        print(f"  {result.error}")
    return 0 if result.ok else 1


def run_merge_dir(args) -> int:
    """单独合并一个目录里的 ts，不做抓取。"""
    from .tsmerge import merge_directory, probe

    directory = Path(args.merge_dir)
    if not directory.is_dir():
        print(f"目录不存在：{directory}")
        return 1

    print(f"扫描：{directory.resolve()}\n")
    results = merge_directory(
        directory,
        out_dir=directory,
        min_count=max(2, args.merge_min),
        keep_parts=not args.delete_parts,
        use_ffmpeg=not args.no_ffmpeg,
    )

    if not results:
        print("没有找到可合并的 ts 文件。\n"
              "（单个未成序列的 ts 会被转封装成 mp4；\n"
              "  若一个都没有，检查目录里是否有 .ts 文件）")
        return 1

    print("\n" + "=" * 56)
    ok_count = 0
    for r in results:
        if r.ok:
            ok_count += 1
            size = human_size(r.size)
            extra = ""
            info = probe(r.output)
            if info.get("duration"):
                extra = f"，{info['duration']:.1f}s"
            print(f"  [OK ] {r.name}: {r.count} 片 -> "
                  f"{Path(r.output).name}（{size}{extra}，{r.method}）")
        else:
            print(f"  [跳过] {r.name}: {r.error.splitlines()[0]}")

    print(f"\n成功合并 {ok_count} 个序列，共 {len(results)} 组")
    if not args.delete_parts:
        print("原分片已保留，确认能播放后可手动删除（或加 --delete-parts）")
    return 0 if ok_count else 1


def merge_after_crawl(args, store_dir: str | Path) -> None:
    """抓取结束后，顺手把散装 ts 合并掉。"""
    from .tsmerge import merge_directory, probe

    store_dir = Path(store_dir)
    print("\n开始合并 ts 分片：")

    def on_result(r) -> None:
        if r.ok:
            info = probe(r.output)
            dur = f"，{info['duration']:.1f}s" if info.get("duration") else ""
            print(f"  [OK ] {r.name}: {r.count} 片 -> "
                  f"{Path(r.output).name}（{human_size(r.size)}{dur}，{r.method}）")
        else:
            print(f"  [跳过] {r.name}: {r.error.splitlines()[0]}")

    results = merge_directory(
        store_dir,
        out_dir=store_dir,
        min_count=max(2, args.merge_min),
        keep_parts=not args.delete_parts,
        use_ffmpeg=not args.no_ffmpeg,
        on_result=on_result,
    )
    if not results:
        print("  没有发现成序列的 ts 分片，跳过")
    elif not any(r.ok for r in results):
        print("  没有可合并的序列（可能是加密分片，需改抓 m3u8 地址）")


def _blob_log(event: str, payload, quiet: bool) -> None:
    """浏览器后端的进度输出。"""
    if quiet:
        return
    if event == "videos":
        for v in payload:
            tag = "blob" if v.get("blob") else "直链"
            print(f"[video] {tag:<4} {v.get('src', '')[:70]}")
    elif event == "network":
        print(f"[网络] {payload['size']:>9} 字节  {payload['url'][:70]}")
    elif event == "waiting":
        print(f"\r    已捕获 {payload} 个分片", end="", flush=True)
    elif event == "collect_start":
        print(f"\n取出 {payload} 个分片：")
    elif event == "collect":
        print(f"\r    取片 {payload['index']}/{payload['total']}",
              end="", flush=True)
    elif event == "fallback":
        print(f"\nMSE 未捕获到数据，改用网络层抓到的 {payload} 个媒体响应")
    elif event == "warn":
        print(f"[提示] {payload}")


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    verbose = not args.quiet

    if args.check_blob:
        return check_blob_env()

    # 只合并、不抓取：这条路径不需要网址
    if args.merge_dir:
        return run_merge_dir(args)

    if not args.url:
        build_parser().error("请提供网址，或用 --check-blob / --merge-dir")

    if args.browser:
        return run_blob(args)

    # 只列码流：一条独立路径，不进抓取流程
    if args.list_variants:
        client = HttpClient(proxy=args.proxy, obey_robots=not args.no_robots)
        variants = hls_variants(client, args.url)
        if not variants:
            print("没有解析到任何码流，确认地址是有效的 m3u8。")
            return 1
        print(f"共 {len(variants)} 路码流：\n")
        for i, v in enumerate(variants, 1):
            mbps = f"{v['bandwidth'] / 1e6:.2f} Mbps" if v["bandwidth"] else "-"
            print(f"  {i:>2}. {v['resolution'] or '未知分辨率':<12} {mbps:<14} {v['uri']}")
        print("\n用 --hls 720p 这样的参数指定要下哪一路。")
        return 0

    config = CrawlConfig(
        depth=max(1, args.depth),
        max_pages=max(1, args.max_pages),
        max_resources=args.max_resources,
        workers=max(1, args.workers),
        kinds=args.kind,
        min_size=args.min_size,
        max_size=args.max_size,
        same_domain=not args.all_domains,
        include_subdomains=not args.no_subdomains,
        parse_css=not args.no_css,
        scan_scripts=not args.no_scripts,
        follow_iframes=args.follow_iframes,
        hls_prefer=args.hls,
        use_ffmpeg=not args.no_ffmpeg,
        obey_robots=not args.no_robots,
    )

    client = HttpClient(
        user_agent=args.ua or DEFAULT_UA,
        delay=args.delay,
        retries=args.retries,
        timeout=(10, args.timeout),
        proxy=args.proxy,
        headers=parse_pairs(args.header) or None,
        cookies=parse_pairs(args.cookie) or None,
        obey_robots=not args.no_robots,
    )
    store = FileStore(args.out, dedup=True)

    # 进度输出：普通资源一行一条，HLS 用 \r 实时刷新分片进度
    state = {"done": 0, "total": 0, "hls_line": False}

    def on_event(event: str, payload) -> None:
        if not verbose:
            return
        if event == "page":
            if payload.error:
                print(f"[页面] {payload.url}  {payload.error}")
            else:
                print(f"[页面] {payload.url}  发现 {payload.found} 条资源")
        elif event == "resource":
            state["done"] += 1
            if state["hls_line"]:
                sys.stdout.write("\n")
                state["hls_line"] = False
            mark = "OK " if payload.ok else "X  "
            extra = ""
            if payload.extra.get("segments"):
                bits = [f"{payload.extra['segments']} 分片"]
                if payload.extra.get("resolution"):
                    bits.insert(0, payload.extra["resolution"])
                if payload.extra.get("encrypted"):
                    bits.append("已解密")
                if payload.extra.get("merge"):
                    bits.append(payload.extra["merge"])
                extra = f" ({', '.join(bits)})"
            tail = f"  {payload.error}" if payload.error else f"  {human_size(payload.size)}"
            # 内联图在总数统计之前就落盘了，此时分母还是 0，显示成 ?
            total = state["total"] or "?"
            print(f"  [{state['done']}/{total}] {mark} {payload.kind:<6} "
                  f"{payload.path or payload.url}{extra}{tail}")
        elif event == "hls":
            done, total = payload["done"], payload["total"]
            # 多个流并发下载时带上名字，进度才不会看混
            label = f" {payload['name']}" if payload.get("name") else ""
            sys.stdout.write(f"\r    分片下载 {done}/{total}{label}")
            sys.stdout.flush()
            state["hls_line"] = True
        elif event == "download_start":
            state["total"] = payload
            if payload:
                print(f"\n开始下载 {payload} 个资源：")
            else:
                print("\n没有发现可抓取的资源。")

    crawler = Crawler(client, store, config, on_event=on_event)

    print(f"目标：{args.url}")
    print(f"输出：{Path(args.out).resolve()}\n")
    report = crawler.run(args.url)

    if state.get("hls_line"):
        sys.stdout.write("\n")

    manifest = args.manifest or str(Path(args.out) / "manifest.json")
    report.save(manifest)

    print("\n" + "=" * 56)
    print(report.summary())
    print(f"清单：{manifest}")

    # 散装 ts 分片合并成完整视频
    if args.merge_ts:
        videos_dir = Path(args.out) / "videos"
        merge_after_crawl(args, videos_dir if videos_dir.is_dir() else args.out)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
