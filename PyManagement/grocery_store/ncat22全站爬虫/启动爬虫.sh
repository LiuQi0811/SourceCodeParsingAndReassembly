#!/bin/bash
# ncat22.com 全站爬虫启动脚本（Linux/Mac）

echo "========================================"
echo "ncat22.com 全站爬虫 - 一键启动"
echo "========================================"
echo ""

# 检查Python
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未检测到Python3，请先安装Python 3.8+"
    exit 1
fi

# 检查依赖
echo "正在检查依赖..."
if ! python3 -c "import DrissionPage" 2>/dev/null; then
    echo "正在安装依赖包..."
    pip3 install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
fi

echo ""
echo "依赖检查完成，开始爬取..."
echo ""
echo "[提示] 按 Ctrl+C 可随时停止爬虫，下次运行会自动断点续爬"
echo ""

python3 ncat22_spider.py https://www.ncat22.com/ "$@"

echo ""
echo "爬取结束！"
echo "文件保存在 output/www.ncat22.com/ 目录下"
