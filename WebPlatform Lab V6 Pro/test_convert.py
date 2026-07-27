#!/usr/bin/env python3
"""Debug test for conversion."""
import sys
sys.path.insert(0, '/workspace')
from convert import add_param_types_to_code

test_cases = [
    # Basic if statement
    "if (this._wakeLock) { foo(); }",
    # typeof check
    "if (typeof document !== 'undefined' && document.foo) { bar(); }",
    # Arrow function
    "foo.map((x) => x + 1)",
    # Arrow without parens
    "foo.map(x => x + 1)",
    # Method def
    "  _addLog(type, content) { this.setState({}); }",
    # Object method shorthand
    "const obj = { transform(chunk, controller) { controller.enqueue(chunk); } };",
]

for tc in test_cases:
    result = add_param_types_to_code(tc)
    print(f"IN : {tc}")
    print(f"OUT: {result}")
    print()
