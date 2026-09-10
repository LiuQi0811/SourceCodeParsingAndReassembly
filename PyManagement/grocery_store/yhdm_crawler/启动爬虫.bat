@echo off
chcp 65001 >nul
echo ========================================
echo    樱花动漫全站爬虫 - 一键启动
echo ========================================
echo.

echo [1] 检查并安装依赖...
pip install -r requirements.txt -q
echo 依赖安装完成!
echo.

:menu
echo 请选择运行模式:
echo [1] 全站爬取所有动漫
echo [2] 搜索关键词下载
echo [3] 单部动漫ID下载
echo [4] 测试爬取(前3部)
echo [0] 退出
echo.
set /p choice=请输入选项:

if "%choice%"=="1" goto all
if "%choice%"=="2" goto search
if "%choice%"=="3" goto single
if "%choice%"=="4" goto test
if "%choice%"=="0" goto end

echo 无效选项!
goto menu

:all
echo.
echo 开始全站爬取...
python yhdm_crawler.py --mode all
goto end

:search
echo.
set /p keyword=请输入搜索关键词:
python yhdm_crawler.py --mode search --keyword "%keyword%"
goto end

:single
echo.
set /p aid=请输入动漫ID:
python yhdm_crawler.py --mode single --anime_id %aid%
goto end

:test
echo.
echo 测试模式，爬取前3部动漫...
python yhdm_crawler.py --mode all --max_anime 3
goto end

:end
echo.
pause
