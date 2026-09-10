#!/bin/bash
echo "========================================"
echo "   樱花动漫全站爬虫 - 一键启动"
echo "========================================"
echo ""

echo "[1] 检查并安装依赖..."
pip3 install -r requirements.txt -q
echo "依赖安装完成!"
echo ""

echo "请选择运行模式:"
echo "[1] 全站爬取所有动漫"
echo "[2] 搜索关键词下载"
echo "[3] 单部动漫ID下载"
echo "[4] 测试爬取(前3部)"
echo "[0] 退出"
echo ""
read -p "请输入选项: " choice

case $choice in
    1)
        echo ""
        echo "开始全站爬取..."
        python3 yhdm_crawler.py --mode all
        ;;
    2)
        echo ""
        read -p "请输入搜索关键词: " keyword
        python3 yhdm_crawler.py --mode search --keyword "$keyword"
        ;;
    3)
        echo ""
        read -p "请输入动漫ID: " aid
        python3 yhdm_crawler.py --mode single --anime_id $aid
        ;;
    4)
        echo ""
        echo "测试模式，爬取前3部动漫..."
        python3 yhdm_crawler.py --mode all --max_anime 3
        ;;
    0)
        exit 0
        ;;
    *)
        echo "无效选项!"
        ;;
esac

echo ""
echo "完成"
