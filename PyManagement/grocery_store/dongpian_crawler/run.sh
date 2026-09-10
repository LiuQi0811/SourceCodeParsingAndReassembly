#!/bin/bash
# 懂片帝AI全站爬虫 - 快速启动脚本
cd "$(dirname "$0")"

echo "=== 懂片帝AI (dongpian1.com) 全站爬虫 ==="
echo ""
echo "请选择运行模式："
echo "1) 全站抓取（推荐，首页+分类+多关键词搜索+详情）"
echo "2) 搜索指定关键词"
echo "3) 演示模式（快速测试）"
echo "4) 只抓列表不抓详情（快速）"
echo ""
read -p "请输入选项 (1-4): " choice

case $choice in
    1)
        echo "启动全站抓取..."
        python3 dongpian_listener_crawler.py
        ;;
    2)
        read -p "请输入搜索关键词: " kw
        python3 dongpian_listener_crawler.py --keyword "$kw"
        ;;
    3)
        echo "启动演示模式..."
        python3 dongpian_listener_crawler.py --demo
        ;;
    4)
        echo "快速列表抓取..."
        python3 dongpian_listener_crawler.py --no-details
        ;;
    *)
        echo "无效选项"
        exit 1
        ;;
esac
