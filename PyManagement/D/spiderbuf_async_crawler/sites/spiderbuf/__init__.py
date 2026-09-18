"""SpiderBuf 靶场适配：签名器 + 39 关任务定义。

设计：
- solvers.py：两步请求/签名关卡（c01/c03/c06/c07/c08/c09/c10/c11/h05）的
  异步签名器，注入引擎 solver_registry（策略模式 + 注册表）
- challenges.py：39 关任务定义；简单关卡用任务配置直抓，复杂关卡
  （浏览器指纹/OCR/JS 求值/复杂解析）通过 external_script 复用现有
  spiders/ 实测脚本（外部执行器策略）
"""
