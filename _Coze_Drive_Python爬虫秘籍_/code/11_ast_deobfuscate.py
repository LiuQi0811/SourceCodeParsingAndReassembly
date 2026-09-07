# -*- coding: utf-8 -*-
"""11_ast_deobfuscate.py —— 第 10 章「AST 反混淆」实战。

把靶场 08_flask_lab.py 页面里被混淆的签名 JS 自动还原成可读代码：
  1) 常量折叠：  "SPI" + "DER_" + "LAB"  →  "SPIDER_LAB"
  2) 变量重命名：_0x1 → secretSalt、_0xs → calcSignature
  3) 语义自检：  把还原后的 JS 交给 Node 重跑，与 Python 参考实现比对签名

用法：
    pip install esprima            # 纯 Python 的 JS 解析器
    python 11_ast_deobfuscate.py   # 装了 Node.js 会自动多做一步自检

还原结果保存在 code/out/deobfuscated_lab.js。
"""
import json
import subprocess
from pathlib import Path

import esprima

OUT_DIR = Path(__file__).resolve().parent / "out"
CHECK_KW, CHECK_TS = "cpu", "1725000000"

# —— 靶场页面里的「混淆版」签名 JS（原样搬来，与第 9 章见到的一致）——
OBFUSCATED_JS = '''var _0x1 = "SPI" + "DER_" + "LAB";
function _0xs(a, b) {
  var h = 5381;
  var s = a + "|" + b + "|" + _0x1;
  for (var i = 0; i < s.length; i++) {
    h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}'''

RENAME_MAP = {"_0x1": "secretSalt", "_0xs": "calcSignature"}


def parse(code: str):
    """解析 JS 为 AST；range 选项让每个节点携带源码位置，用于原位替换。"""
    return esprima.parseScript(code, {"range": True, "tolerant": True})


def iter_nodes(node):
    """深度优先遍历所有 AST 节点。"""
    yield node
    for value in vars(node).values():
        if hasattr(value, "type"):
            yield from iter_nodes(value)
        elif isinstance(value, list):
            for item in value:
                if hasattr(item, "type"):
                    yield from iter_nodes(item)


def _const_str(node):
    """节点是纯字符串字面量 + 链时返回拼接结果，否则返回 None。"""
    if node.type == "Literal" and isinstance(node.value, str):
        return node.value
    if node.type == "BinaryExpression" and node.operator == "+":
        left, right = _const_str(node.left), _const_str(node.right)
        if left is not None and right is not None:
            return left + right
    return None


def fold_strings(code: str):
    """Pass 1 · 常量折叠：把纯字符串 + 链折叠成单个字面量。"""
    candidates = []
    for node in iter_nodes(parse(code)):
        if node.type == "BinaryExpression" and node.operator == "+":
            value = _const_str(node)
            if value is not None:
                candidates.append((node.range[0], node.range[1],
                                   json.dumps(value, ensure_ascii=False)))
    # 只保留最外层节点（内层已被外层覆盖）
    kept = [c for c in candidates
            if not any(o != c and o[0] <= c[0] and c[1] <= o[1] for o in candidates)]
    detail = []
    for start, end, text in sorted(kept, reverse=True):   # 从后往前替换
        detail.append(f"{code[start:end]}  →  {text}")
        code = code[:start] + text + code[end:]
    return code, detail


def rename_identifiers(code: str):
    """Pass 2 · 变量重命名：按映射表替换所有 Identifier 节点。"""
    renames = []
    for node in iter_nodes(parse(code)):
        if node.type == "Identifier" and node.name in RENAME_MAP:
            renames.append((node.range[0], node.range[1], RENAME_MAP[node.name]))
    counts = {}
    for start, end, new in sorted(renames, reverse=True):  # 从后往前替换
        old = code[start:end]
        counts[old] = counts.get(old, 0) + 1
        code = code[:start] + new + code[end:]
    return code, counts


def python_reference(kw: str, ts: str) -> str:
    """Python 参考实现（与靶场服务端一致）。"""
    h = 5381
    for ch in f"{kw}|{ts}|SPIDER_LAB":
        h = (((h << 5) + h) + ord(ch)) & 0xFFFFFFFF
    return format(h, "x")


def node_semantic_check(js_code: str):
    """Pass 3 · 语义自检：让 Node 执行还原后的 JS，与参考实现比对。"""
    check_path = OUT_DIR / "_check.js"
    check_path.write_text(
        js_code + f"\nconsole.log('SIGN|' + calcSignature('{CHECK_KW}', '{CHECK_TS}'));",
        encoding="utf-8",
    )
    try:
        proc = subprocess.run(["node", str(check_path)],
                              capture_output=True, text=True, timeout=20)
    except FileNotFoundError:
        return None, "未检测到 Node.js，跳过（装好 Node 后重跑可看到自检）"
    finally:
        check_path.unlink(missing_ok=True)
    for line in proc.stdout.splitlines():
        if line.startswith("SIGN|"):
            return line.split("|", 1)[1].strip(), None
    return None, f"Node 输出异常：{proc.stderr.strip()[:120]}"


def main():
    print("=" * 60)
    print("AST 反混淆：自动还原靶场签名函数")
    print("=" * 60)

    folded, fold_detail = fold_strings(OBFUSCATED_JS)
    print(f"\n[1] 常量折叠：{len(fold_detail)} 处")
    for item in fold_detail:
        print("    " + item)

    final, counts = rename_identifiers(folded)
    print(f"\n[2] 变量重命名：{len(counts)} 类共 {sum(counts.values())} 处")
    for old, new in RENAME_MAP.items():
        if old in counts:
            print(f"    {old} → {new}")

    print("\n[3] 还原结果：")
    print(final)

    OUT_DIR.mkdir(exist_ok=True)
    out_file = OUT_DIR / "deobfuscated_lab.js"
    out_file.write_text(final + "\n", encoding="utf-8")
    print(f"\n已保存到 {out_file}")

    value, err = node_semantic_check(final)
    ref = python_reference(CHECK_KW, CHECK_TS)
    if value is None:
        print(f"[4] 语义自检：{err}")
    else:
        verdict = "PASS" if value == ref else f"FAIL（Node={value}, Python={ref}）"
        print(f"[4] 语义自检：calcSignature('{CHECK_KW}', '{CHECK_TS}') = {value}  {verdict}")


if __name__ == "__main__":
    main()
