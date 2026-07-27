#!/usr/bin/env python3
"""Debug test for conversion - simpler cases."""
import sys
sys.path.insert(0, '/workspace')
from convert import add_param_types_to_code

test_cases = [
    "this._wakeLock",
    "if (this._wakeLock) { }",
    "if (x) { }",
    "if (foo) { }",
    "document !== 'undefined'",
    "x !== y",
    "if (this._wakeLock)",
]

for tc in test_cases:
    result = add_param_types_to_code(tc)
    print(f"IN : {tc!r}")
    print(f"OUT: {result!r}")
    print()
