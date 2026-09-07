Python 爬虫秘籍 · 配套代码
==========================
环境要求：Python 3.14.x（3.13 亦可运行）

使用步骤：
1. 安装依赖：  pip install -r requirements.txt
2. 按编号顺序学习：01 → 11
3. 每个文件顶部都有说明，直接运行：python 文件名.py

注意事项：
- 07 需要先执行一次：playwright install chromium（下载浏览器内核）
- 05 不联网即可运行；01-04、06 访问的都是 toscrape.com 练习靶场
  （books.toscrape.com / quotes.toscrape.com 专为爬虫学习而建，可放心练习）
- 08/09 是第 9 章 Web 逆向实战：先启动 08 本地靶场（pip install flask），
  再运行 09 逆向脚本，体验从 403 到 200 的完整流程
- 10/11 是第 10 章逆向进阶实操（同样先启动 08 靶场）：
  10 补环境实战需要 Node.js（无需任何 npm 包）：node 10_env_patch.js
  11 AST 反混淆需要 pip install esprima；语义自检会自动调用 Node.js（可选）
  11 运行后会在 code/out/ 下生成还原结果 deobfuscated_lab.js
- 所有脚本自带限速或仅访问本地服务，请保持这个好习惯
