#!/bin/bash
# Coverr.co 全站爬虫启动脚本

echo "============================================"
echo "  Coverr.co 全站视频爬虫 - 快速启动"
echo "============================================"
echo ""
echo "请选择下载分辨率:"
echo "1) original  (原始画质，文件最大)"
echo "2) 1080p     (全高清，默认推荐)"
echo "3) 720p      (高清，平衡画质与体积)"
echo "4) 480p      (标清)"
echo "5) 360p      (流畅，体积最小/测试用)"
echo ""
read -p "请输入选项 [2]: " res_choice
res_choice=${res_choice:-2}

case $res_choice in
    1) res="original" ;;
    2) res="1080p" ;;
    3) res="720p" ;;
    4) res="480p" ;;
    5) res="360p" ;;
    *) res="1080p" ;;
esac

echo ""
read -p "并发下载数（建议4-16，默认8）: " workers
workers=${workers:-8}

echo ""
read -p "输出目录（默认./coverr_downloads）: " output
output=${output:-./coverr_downloads}

echo ""
read -p "限制下载数量（0=全部，默认先下载10个测试）: " limit
limit=${limit:-10}

echo ""
echo "============================================"
echo "即将开始下载:"
echo "  分辨率: $res"
echo "  并发数: $workers"
echo "  输出目录: $output"
echo "  数量限制: $limit"
echo "============================================"
echo ""
read -p "确认开始？(y/n): " confirm
if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
    python3 coverr_scraper.py -r "$res" -w "$workers" -o "$output" -l "$limit"
else
    echo "已取消"
fi
