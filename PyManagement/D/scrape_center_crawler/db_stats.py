# -*- coding: utf-8 -*-
"""从全站扫描 DB 统计各站点抓取结果"""
import sqlite3

conn = sqlite3.connect(r"output\allsites\all.db")
cur = conn.execute("""
    SELECT task_id,
           SUM(CASE WHEN state='done' THEN 1 ELSE 0 END) AS done,
           SUM(CASE WHEN state='failed' THEN 1 ELSE 0 END) AS failed,
           SUM(CASE WHEN state='pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN state='processing' THEN 1 ELSE 0 END) AS processing,
           COUNT(*) AS total
    FROM crawl_queue
    GROUP BY task_id
    ORDER BY task_id
""")
rows = cur.fetchall()
print(f"{'task':<14}{'done':>7}{'failed':>7}{'pending':>8}{'total':>7}")
for r in rows:
    print(f"{r[0]:<14}{r[1]:>7}{r[2]:>7}{r[3]:>8}{r[4]:>7}")
print("-" * 50)
t = conn.execute("SELECT COUNT(DISTINCT task_id) FROM crawl_queue").fetchone()[0]
print(f"任务数: {t}  总行数: {conn.execute('SELECT COUNT(*) FROM crawl_queue').fetchone()[0]}")
conn.close()
