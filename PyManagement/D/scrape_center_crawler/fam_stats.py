# -*- coding: utf-8 -*-
"""按站点族聚合全站扫描统计"""
import sqlite3

conn = sqlite3.connect(r"output\allsites\all.db")

# 页面行：done 且不是资源；资源行：is_resource=1
cur = conn.execute("""
    SELECT task_id,
           SUM(CASE WHEN state='done' AND is_resource=0 THEN 1 ELSE 0 END) AS pages_done,
           SUM(CASE WHEN state='failed' AND is_resource=0 THEN 1 ELSE 0 END) AS pages_failed,
           SUM(CASE WHEN state='done' AND is_resource=1 THEN 1 ELSE 0 END) AS res_done,
           SUM(CASE WHEN state='failed' AND is_resource=1 THEN 1 ELSE 0 END) AS res_failed,
           COUNT(*) AS total
    FROM crawl_queue
    GROUP BY task_id
""")
rows = {r[0]: r[1:] for r in cur.fetchall()}

families = {
    "ssr 服务端渲染": ["ssr1", "ssr2", "ssr3", "ssr4"],
    "spa Ajax": [f"spa{i}" for i in range(1, 17)],
    "tool 工具": ["tool1"],
    "captcha 验证码": [f"captcha{i}" for i in range(1, 9)],
    "login 登录": ["login1", "login2", "login3"],
    "websocket": ["websocket1"],
    "antispider 反爬": [f"antispider{i}" for i in range(1, 11)],
    "appbasic 原生": ["appbasic1", "appbasic2"],
    "app 应用": [f"app{i}" for i in range(1, 10)],
}
total_pages = total_res = total_pf = total_rf = 0
print(f"{'族':<20}{'站点':>4}{'页面成功':>8}{'页面失败':>8}{'资源成功':>8}{'资源失败':>8}")
fam_out = []
for fam, sites in families.items():
    pd = pf = rd = rf = 0
    for s in sites:
        if s in rows:
            a, b, c, d, _ = rows[s]
            pd += a; pf += b; rd += c; rf += d
    total_pages += pd; total_pf += pf; total_res += rd; total_rf += rf
    fam_out.append((fam, len(sites), pd, pf, rd, rf))
    print(f"{fam:<20}{len(sites):>4}{pd:>8}{pf:>8}{rd:>8}{rf:>8}")
print("-" * 56)
print(f"{'合计':<20}{'54':>4}{total_pages:>8}{total_pf:>8}{total_res:>8}{total_rf:>8}")

# 每个站点单行（用于 README 表格）
print("\n=== 每站点 ===")
for s in sorted(rows):
    pd, pf, rd, rf, tot = rows[s]
    print(f"{s},{pd},{pf},{rd},{rf}")
conn.close()
