#!/usr/bin/env python3
"""
Adobe Stock 日本站爬虫 - 主入口
命令行工具，支持多种爬取模式

使用示例：
  python main.py search --keyword "東京 風景" --max-pages 3
  python main.py search --keyword "桜" --type illustrations --max-pages 2
  python main.py category --name photos --max-pages 5
  python main.py detail --url "https://stock.adobe.com/jp/photo/123456789"
  python main.py contributor --url "https://stock.adobe.com/jp/contributor/2070"
"""
import sys
import logging
from pathlib import Path

import click
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

from config import OUTPUT_DIR, STORAGE_FORMAT
from storage import create_storage
from search_crawler import SearchCrawler
from category_crawler import CategoryCrawler
from detail_crawler import DetailCrawler
from contributor_crawler import ContributorCrawler

logger = logging.getLogger("adobe_crawler")


@click.group()
@click.option("--debug", is_flag=True, help="开启调试日志")
@click.option("--format", "fmt", default=STORAGE_FORMAT, type=click.Choice(["json", "csv", "sqlite"]),
              help="输出数据格式")
@click.pass_context
def cli(ctx, debug, fmt):
    """Adobe Stock 日本站 (stock.adobe.com/jp) 爬虫工具"""
    ctx.ensure_object(dict)
    ctx.obj["format"] = fmt

    if debug:
        logging.getLogger().setLevel(logging.DEBUG)

    # 打印法律声明
    click.echo("=" * 60)
    click.echo(click.style("⚠️  法律合规声明", fg="yellow", bold=True))
    click.echo("本工具仅供教育研究使用，请遵守 Adobe Stock 服务条款")
    click.echo("禁止：绕过付费墙下载版权素材、批量囤积、商业用途")
    click.echo("正式使用请购买 Enterprise 计划获取官方 API 授权")
    click.echo("=" * 60)


@cli.command()
@click.option("--keyword", "-k", required=True, help="搜索关键词（支持日文/中文/英文）")
@click.option("--type", "asset_type", default="photos",
              type=click.Choice(["photos", "illustrations", "vectors", "videos", "audio", "templates", "3d", "free"]),
              help="素材类型")
@click.option("--sort", "sort_by", default="relevance",
              type=click.Choice(["relevance", "newest", "popular", "price_asc", "price_desc", "undiscovered"]),
              help="排序方式")
@click.option("--max-pages", "-p", default=3, type=int, help="最大爬取页数")
@click.option("--start-page", default=1, type=int, help="起始页码")
@click.option("--output", "-o", default="", help="输出文件名前缀")
@click.option("--selenium", is_flag=True, help="使用 Selenium 浏览器模式（绕过 Cloudflare）")
@click.pass_context
def search(ctx, keyword, asset_type, sort_by, max_pages, start_page, output, selenium):
    """按关键词搜索素材"""
    fmt = ctx.obj["format"]
    output_name = output or f"search_{keyword}_{asset_type}"

    storage = create_storage(fmt, output_name)
    crawler = SearchCrawler(use_selenium=selenium)

    click.echo(f"\n🔍 开始搜索: {keyword} ({asset_type}), 排序: {sort_by}")
    click.echo(f"📄 页数: {max_pages}, 格式: {fmt}, 输出: {storage.output_path if hasattr(storage, 'output_path') else 'sqlite'}\n")

    try:
        items = crawler.crawl(
            keyword=keyword,
            asset_type=asset_type,
            sort_by=sort_by,
            max_pages=max_pages,
            start_page=start_page,
            storage=storage,
        )
        click.echo(click.style(f"\n✅ 完成！共获取 {len(items)} 个素材", fg="green", bold=True))
    except KeyboardInterrupt:
        click.echo(click.style("\n⏹ 用户中断", fg="yellow"))
    finally:
        storage.close()
        crawler.close()


@cli.command()
@click.option("--url", "-u", default="", help="分类页完整URL")
@click.option("--name", "-n", default="photos",
              type=click.Choice(["photos", "illustrations", "vectors", "videos", "audio", "templates", "3d", "free", "premium", "new"]),
              help="分类名称（不指定URL时使用）")
@click.option("--max-pages", "-p", default=3, type=int, help="最大爬取页数")
@click.option("--start-page", default=1, type=int, help="起始页码")
@click.option("--output", "-o", default="", help="输出文件名前缀")
@click.option("--selenium", is_flag=True, help="使用 Selenium 浏览器模式")
@click.pass_context
def category(ctx, url, name, max_pages, start_page, output, selenium):
    """按分类浏览素材"""
    fmt = ctx.obj["format"]
    output_name = output or f"category_{name}"

    storage = create_storage(fmt, output_name)
    crawler = CategoryCrawler(use_selenium=selenium)

    click.echo(f"\n📂 开始爬取分类: {name or url}, 页数: {max_pages}\n")

    try:
        items = crawler.crawl(
            category_url=url,
            category_name=name,
            max_pages=max_pages,
            start_page=start_page,
            storage=storage,
        )
        click.echo(click.style(f"\n✅ 完成！共获取 {len(items)} 个素材", fg="green", bold=True))
    except KeyboardInterrupt:
        click.echo(click.style("\n⏹ 用户中断", fg="yellow"))
    finally:
        storage.close()
        crawler.close()


@cli.command()
@click.option("--url", "-u", required=True, help="素材详情页 URL")
@click.option("--output", "-o", default="detail", help="输出文件名前缀")
@click.option("--selenium", is_flag=True, help="使用 Selenium 浏览器模式")
@click.pass_context
def detail(ctx, url, output, selenium):
    """抓取单个素材详情页元数据"""
    fmt = ctx.obj["format"]
    storage = create_storage(fmt, output)
    crawler = DetailCrawler(use_selenium=selenium)

    click.echo(f"\n📋 抓取详情页: {url}\n")

    try:
        item = crawler.crawl(url=url, storage=storage)
        if item:
            click.echo(click.style(f"\n✅ 详情获取成功！", fg="green", bold=True))
            click.echo(f"   ID: {item.get('id')}")
            click.echo(f"   标题: {item.get('title', '')[:80]}")
            click.echo(f"   作者: {item.get('contributor_name') or item.get('author', '')}")
            click.echo(f"   尺寸: {item.get('width', '')} x {item.get('height', '')}")
        else:
            click.echo(click.style("\n❌ 获取失败", fg="red"))
    except KeyboardInterrupt:
        click.echo(click.style("\n⏹ 用户中断", fg="yellow"))
    finally:
        storage.close()
        crawler.close()


@cli.command()
@click.option("--url", "-u", required=True, help="作者主页 URL")
@click.option("--max-pages", "-p", default=3, type=int, help="最大爬取页数")
@click.option("--output", "-o", default="", help="输出文件名前缀")
@click.option("--selenium", is_flag=True, help="使用 Selenium 浏览器模式")
@click.pass_context
def contributor(ctx, url, max_pages, output, selenium):
    """抓取作者（贡献者）作品集"""
    fmt = ctx.obj["format"]
    # 从 URL 提取作者 ID
    import re
    match = re.search(r'/contributor/(\d+)', url)
    cid = match.group(1) if match else "unknown"
    output_name = output or f"contributor_{cid}"

    storage = create_storage(fmt, output_name)
    crawler = ContributorCrawler(use_selenium=selenium)

    click.echo(f"\n👤 爬取作者作品集: {url}, 页数: {max_pages}\n")

    try:
        items = crawler.crawl(url=url, max_pages=max_pages, storage=storage)
        click.echo(click.style(f"\n✅ 完成！共获取 {len(items)} 个素材", fg="green", bold=True))
    except KeyboardInterrupt:
        click.echo(click.style("\n⏹ 用户中断", fg="yellow"))
    finally:
        storage.close()
        crawler.close()


if __name__ == "__main__":
    cli(obj={})
