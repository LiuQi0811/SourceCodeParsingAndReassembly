# -*- coding: utf-8 -*-
"""
多轮抓取报告对比工具：对比多个 report.json（由 main.py 收尾生成），
输出关键指标演进表，用于迭代复盘与回归确认。

用法:
    python compare_reports.py output/allsites_v5/report.json output/allsites_v6/report.json ...
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def _fmt(n) -> str:
    return f"{int(n):,}" if isinstance(n, (int, float)) else str(n)


def main(argv: list) -> int:
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    rows = []
    for p in argv:
        path = Path(p)
        if not path.exists():
            print(f"文件不存在: {path}")
            return 2
        d = json.loads(path.read_text(encoding="utf-8"))
        rows.append((str(path), d))

    headers = [
        ("版本", lambda d: Path(d["output_dir"]).name if d.get("output_dir") else "?"),
        ("耗时(s)", lambda d: round(d.get("elapsed_seconds", 0), 1)),
        ("页面成功", lambda d: d.get("pages_fetched", 0)),
        ("页面失败", lambda d: d.get("pages_failed", 0)),
        ("资源成功", lambda d: d.get("resources_downloaded", 0)),
        ("资源失败", lambda d: d.get("resources_failed", 0)),
        ("下载字节", lambda d: d.get("bytes_downloaded", 0)),
        ("站点数", lambda d: len(d.get("sites", []))),
    ]
    widths = [len(h) for h, _ in headers]
    lines = [[h for h, _ in headers]]
    for name, d in rows:
        line = []
        for i, (h, fn) in enumerate(headers):
            v = fn(d)
            line.append(v)
            widths[i] = max(widths[i], len(str(v)))
        lines.append(line)

    fmt = "  ".join(f"{{:<{w}}}" for w in widths)
    for i, line in enumerate(lines):
        print(fmt.format(*[str(x) for x in line]))
        if i == 0:
            print("-" * sum(widths) + "-" * (3 * (len(widths) - 1)))

    # 失败原因分布对比
    print("\n失败原因分布:")
    for name, d in rows:
        reasons = d.get("failure_reasons") or {}
        label = Path(d["output_dir"]).name if d.get("output_dir") else Path(name).parent.name
        if reasons:
            detail = "  ".join(f"{k}={v}" for k, v in sorted(reasons.items(), key=lambda x: -x[1]))
        else:
            detail = "(无失败)"
        print(f"  {label}: {detail}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
