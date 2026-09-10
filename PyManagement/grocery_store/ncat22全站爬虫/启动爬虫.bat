@echo off
chcp 65001 >nul
echo ========================================
echo ncat22.com 全站爬虫 - 一键启动
echo ========================================
echo.

:: 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到Python，请先安装Python 3.8+
    pause
    exit /b 1
)

:: 检查依赖是否安装
echo 正在检查依赖...
pip show DrissionPage >nul 2>&1
if errorlevel 1 (
    echo 正在安装依赖包...
    pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
)

echo.
echo 依赖检查完成，开始爬取...
echo.
echo [提示] 按 Ctrl+C 可随时停止爬虫，下次运行会自动断点续爬
echo.

python ncat22_spider.py https://www.ncat22.com/

echo.
echo 爬取结束！
echo 文件保存在 output/www.ncat22.com/ 目录下
pause
