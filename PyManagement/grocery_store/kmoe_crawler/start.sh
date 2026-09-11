#!/bin/bash
# Kmoe 爬虫快速启动脚本

echo "============================================"
echo "  Kmoe (kxx.moe) 爬虫工具"
echo "============================================"
echo ""

if [ ! -d "venv" ]; then
    echo "首次运行，安装依赖..."
    pip install -r requirements.txt -q
fi

echo ""
echo "请选择运行模式:"
echo "1) 抓取全站漫画元数据 (无需登录)"
echo "2) 仅获取漫画列表 (前N页)"
echo "3) 查看单本漫画详情"
echo "4) 浏览器自动化下载 (需要登录, 推荐)"
echo "5) 安装浏览器自动化依赖"
echo ""
read -p "请输入选项 [1-5]: " choice

case $choice in
    1)
        read -p "抓取最大页数 (默认10): " maxp
        maxp=${maxp:-10}
        python kmoe_crawler.py --mode metadata --max-pages $maxp --delay 2
        ;;
    2)
        read -p "起始页码 (默认1): " startp
        read -p "抓取页数 (默认3): " maxp
        startp=${startp:-1}
        maxp=${maxp:-3}
        python kmoe_crawler.py --mode list --start-page $startp --max-pages $maxp
        ;;
    3)
        read -p "请输入漫画ID (如25519): " bookid
        python kmoe_crawler.py --mode detail --book-id $bookid
        ;;
    4)
        echo "启动浏览器自动化下载..."
        echo "提示: 浏览器打开后请手动登录，然后按回车继续"
        read -p "抓取列表页数 (默认1): " pages
        pages=${pages:-1}
        python browser_downloader.py --mode download --max-pages $pages
        ;;
    5)
        echo "安装Playwright浏览器自动化..."
        pip install playwright
        playwright install chromium
        echo "安装完成!"
        ;;
    *)
        echo "无效选项"
        ;;
esac

echo ""
echo "完成! 数据保存在 kmoe_data/ 或 kmoe_downloads/ 目录"
