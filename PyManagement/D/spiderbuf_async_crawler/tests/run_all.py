"""自测汇总入口：python -m tests.run_all"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

MODULES = [
    "tests.test_encoding",
    "tests.test_crypto",
    "tests.test_parsers",
    "tests.test_queues",
    "tests.test_video",
    "tests.test_stress",
    "tests.test_graceful_stop",
]


def main() -> int:
    failed = 0
    for mod in MODULES:
        print(f"\n===== {mod} =====")
        code = subprocess.call([sys.executable, "-m", mod], cwd=str(ROOT))
        if code != 0:
            failed += 1
    print("\n" + "=" * 40)
    if failed:
        print(f"✘ {failed} 个模块失败")
        return 1
    print("✔ 全部自测通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
