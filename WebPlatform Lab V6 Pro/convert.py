#!/usr/bin/env python3
"""Convert api-lab JS pages to TypeScript strict-mode."""
import re
import os
import sys

SRC_DIR = '/workspace/src/pages/api-lab'
DST_DIR = '/workspace/ts/pages/api-lab'

# Files to convert (in order). If a file is missing, skip it.
FILES = [
    'PWAModernPage.js',
    'AdvancedJSRuntimePage.js',
    'ModernCSSPage.js',
    'SecurityPrivacyPage.js',
    'AdvancedStoragePage.js',
    'WebCryptoDeepPage.js',
    'PerformanceAPIDeepPage.js',
    'AccessibilityInteractionPage.js',
    'TextEncodingIntlPage.js',
    'WebAnimationsPage.js',
    'CSSObjectModelPage.js',
    'DOMParsersXPathPage.js',
    'AdvancedObserverPage.js',
    'CanvasDeepPage.js',
    'SVGDeepPage.js',
    'WebComponentsDeepPage.js',
    'WebComponentsAdvancedPage.js',
    'StreamsFetchDeepPage.js',
    'WorkerAdvancedPage.js',
    'FetchLaterAPIPage.js',
    'CompressionStreamsPage.js',
    'StreamsPage.js',
    'FileSystemAccessPage.js',
    'FileAccessPage.js',  # FileAPIDeepPage.js doesn't exist; convert FileAccessPage.js
    'FormAPIDeepPage.js',
    'EditingInputEventsPage.js',
    'EditContextActivationPage.js',
    'DragDropDeepPage.js',
    'SelectionClipboardPage.js',
    'PointerTouchEventsDeepPage.js',
]

# Output filenames (same basename, .ts extension)
def out_name(js_name):
    return js_name[:-3] + '.ts'


# ---------- Helpers ----------

def find_matching_paren(s, start):
    """Given s and index of '(', return index of matching ')'. -1 if not found."""
    depth = 0
    i = start
    in_str = None
    while i < len(s):
        c = s[i]
        if in_str:
            if c == '\\':
                i += 2
                continue
            if c == in_str:
                in_str = None
        elif c in ('"', "'", '`'):
            in_str = c
        elif c == '(':
            depth += 1
        elif c == ')':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def split_params(params_str):
    """Split a parameter list string by top-level commas, respecting nesting and strings."""
    params = []
    depth = 0
    current = ''
    in_str = None
    i = 0
    while i < len(params_str):
        c = params_str[i]
        if in_str:
            current += c
            if c == '\\' and i + 1 < len(params_str):
                current += params_str[i + 1]
                i += 2
                continue
            if c == in_str:
                in_str = None
        elif c in ('"', "'", '`'):
            in_str = c
            current += c
        elif c in '([{':
            depth += 1
            current += c
        elif c in ')]}':
            depth -= 1
            current += c
        elif c == ',' and depth == 0:
            params.append(current.strip())
            current = ''
        else:
            current += c
        i += 1
    if current.strip():
        params.append(current.strip())
    return params


def add_type_to_param(p):
    """Add ':any' (or specific type) to a single parameter string if untyped."""
    p = p.strip()
    if not p:
        return p

    # Rest params: ...args or ...args = []
    if p.startswith('...'):
        rest = p[3:].strip()
        if '=' in rest:
            name, default = rest.split('=', 1)
            return f'...{name.strip()}: any[] = {default.strip()}'
        return f'...{rest}: any[]'

    # Destructuring: { ... } or [ ... ]
    if p.startswith('{') or p.startswith('['):
        # Find top-level '=' (default value)
        depth = 0
        eq_pos = -1
        in_str = None
        for j, ch in enumerate(p):
            if in_str:
                if ch == '\\':
                    continue
                if ch == in_str:
                    in_str = None
            elif ch in ('"', "'", '`'):
                in_str = ch
            elif ch in '{[(':
                depth += 1
            elif ch in ')]}':
                depth -= 1
            elif ch == '=' and depth == 0:
                eq_pos = j
                break
        if eq_pos >= 0:
            pattern = p[:eq_pos].rstrip()
            default = p[eq_pos:]
            return f'{pattern}: any{default}'
        return f'{p}: any'

    # Simple identifier with optional default: a or a = 1
    if '=' in p:
        # Split at first top-level '='
        name, default = p.split('=', 1)
        return f'{name.strip()}: any = {default.strip()}'

    # Simple identifier
    return f'{p}: any'


def annotate_params(params_str):
    """Take a raw param list string, return the same with types added to each untyped param."""
    params_str = params_str.strip()
    if not params_str:
        return ''
    params = split_params(params_str)
    out = []
    for p in params:
        out.append(add_type_to_param(p))
    return ', '.join(out)


# ---------- Field type inference ----------

def infer_field_type(name, expr):
    """Infer a TS type for an instance field based on its first assignment expression."""
    e = expr.strip()
    # Boolean literal
    if e in ('true', 'false'):
        return 'boolean'
    # null
    if e == 'null':
        return 'any'
    # Observers
    m = re.match(r'new\s+(IntersectionObserver|MutationObserver|ResizeObserver|PerformanceObserver|AbortController|EventSource|BroadcastChannel|MessageChannel|TextEncoder|TextDecoder|TextEncoderStream|TextDecoderStream|CompressionStream|DecompressionStream|ReadableStream|WritableStream|TransformStream|Map|Set|WeakMap|WeakSet|Date|RegExp|URL|URLSearchParams|Headers|Request|Response|FormData|Blob|File|Image|Audio|Video|HTMLElement|Worker|SharedWorker|ServiceWorker)\b', e)
    if m:
        return f'{m.group(1)} | null'
    # requestAnimationFrame
    if re.match(r'requestAnimationFrame\b', e):
        return 'number | null'
    # setInterval / setTimeout
    if re.match(r'(setInterval|setTimeout)\b', e):
        return 'ReturnType<typeof setTimeout> | null'
    # canvas getContext
    if re.search(r'\.getContext\(', e):
        return 'CanvasRenderingContext2D | null'
    # querySelector returning canvas
    if re.search(r'querySelector.*canvas|HTMLCanvasElement', e, re.IGNORECASE):
        return 'HTMLCanvasElement | null'
    # matchMedia
    if re.match(r'window\.matchMedia\b', e) or re.match(r'matchMedia\b', e):
        return 'MediaQueryList | null'
    # Array literal
    if e.startswith('['):
        return 'any[]'
    # Object literal
    if e.startswith('{'):
        return 'Record<string, any>'
    # Arrow function or function expression
    if re.match(r'\([^)]*\)\s*=>', e) or re.match(r'\w+\s*=>', e) or e.startswith('function') or e.startswith('async'):
        return '(() => void) | null'
    # new Date()
    if re.match(r'new\s+Date\b', e):
        return 'Date | null'
    # Default
    return 'any'


# ---------- Main conversion ----------

# Keywords that look like method calls but aren't method definitions
KEYWORDS = {
    'if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'typeof',
    'function', 'new', 'delete', 'void', 'in', 'instanceof', 'do', 'else',
    'try', 'finally', 'throw', 'class', 'extends', 'super', 'import',
    'export', 'from', 'as', 'default', 'await', 'yield', 'async',
}

# Control-flow keywords followed by ( that we should NOT treat as method def
CTRL_KEYWORDS = {'if', 'for', 'while', 'switch', 'catch', 'with'}


def add_param_types_to_code(code):
    """Walk the code and add :any to untyped parameters in:
    - class methods / object method shorthand:  name(params) {
    - function declarations:  function name(params) {
    - arrow functions:  (params) =>  and  param =>
    """
    result = []
    i = 0
    n = len(code)
    in_str = None
    in_line_comment = False
    in_block_comment = False
    in_template = False

    while i < n:
        c = code[i]
        nxt = code[i + 1] if i + 1 < n else ''

        # Handle comments and strings first
        if in_line_comment:
            result.append(c)
            if c == '\n':
                in_line_comment = False
            i += 1
            continue
        if in_block_comment:
            result.append(c)
            if c == '*' and nxt == '/':
                result.append(nxt)
                i += 2
                in_block_comment = False
                continue
            i += 1
            continue
        if in_str:
            result.append(c)
            if c == '\\' and i + 1 < n:
                result.append(nxt)
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if in_template:
            result.append(c)
            if c == '\\' and i + 1 < n:
                result.append(nxt)
                i += 2
                continue
            if c == '`':
                in_template = False
                i += 1
                continue
            if c == '$' and nxt == '{':
                # Enter ${...}: copy verbatim until matching } (respecting nested braces & strings)
                result.append(nxt)
                i += 2
                depth = 1
                inner_str = None
                while i < n and depth > 0:
                    cc = code[i]
                    result.append(cc)
                    if inner_str:
                        if cc == '\\' and i + 1 < n:
                            result.append(code[i + 1])
                            i += 2
                            continue
                        if cc == inner_str:
                            inner_str = None
                    elif cc in ('"', "'", '`'):
                        inner_str = cc
                    elif cc == '{':
                        depth += 1
                    elif cc == '}':
                        depth -= 1
                    i += 1
                continue
            i += 1
            continue

        # Not in string/comment/template
        if c == '/' and nxt == '/':
            result.append(c)
            result.append(nxt)
            i += 2
            in_line_comment = True
            continue
        if c == '/' and nxt == '*':
            result.append(c)
            result.append(nxt)
            i += 2
            in_block_comment = True
            continue
        if c in ('"', "'"):
            in_str = c
            result.append(c)
            i += 1
            continue
        if c == '`':
            in_template = True
            result.append(c)
            i += 1
            continue

        matched = False

        # Pattern A: function declaration  function name(params) {
        if c == 'f' and code[i:i+8] == 'function' and (i + 8 >= n or (not code[i+8].isalnum() and code[i+8] != '_')):
            j = i + 8
            while j < n and code[j] in ' \t':
                j += 1
            name_match = re.match(r'\w+', code[j:])
            if name_match:
                j += name_match.end()
            while j < n and code[j] in ' \t':
                j += 1
            if j < n and code[j] == '(':
                end = find_matching_paren(code, j)
                if end != -1:
                    params = code[j+1:end]
                    typed = annotate_params(params)
                    result.append(code[i:j+1])
                    result.append(typed)
                    result.append(')')
                    i = end + 1
                    matched = True
            if not matched:
                # Skip the whole 'function' keyword to avoid mis-parsing its chars
                result.append('function')
                i += 8
                matched = True

        # Pattern B/D: identifier-based patterns
        if not matched and (c.isalpha() or c == '_' or c == '$'):
            id_match = re.match(r'[$_\w]+', code[i:])
            if id_match:
                ident = id_match.group(0)
                ident_end = i + id_match.end()
                k = ident_end
                while k < n and code[k] in ' \t':
                    k += 1

                # Pattern B: identifier(params) {  (method def)
                if k < n and code[k] == '(' and ident not in CTRL_KEYWORDS and ident not in KEYWORDS:
                    end = find_matching_paren(code, k)
                    if end != -1:
                        m = end + 1
                        while m < n and code[m] in ' \t\n\r':
                            m += 1
                        if m < n and (code[m] == '{' or (code[m] == '=' and m + 1 < n and code[m+1] == '>')):
                            params = code[k+1:end]
                            typed = annotate_params(params)
                            result.append(code[i:k+1])
                            result.append(typed)
                            result.append(')')
                            i = end + 1
                            matched = True

                # Pattern D: single identifier =>  (arrow function, no parens)
                if not matched and k + 1 < n and code[k] == '=' and code[k+1] == '>' and ident not in KEYWORDS:
                    result.append('(')
                    result.append(ident)
                    result.append(': any) =>')
                    i = k + 2
                    matched = True

                # If no pattern matched, skip the whole identifier
                if not matched:
                    result.append(ident)
                    i = ident_end
                    matched = True

        # Pattern C: (params) =>   (arrow function)
        if not matched and c == '(':
            end = find_matching_paren(code, i)
            if end != -1:
                m = end + 1
                while m < n and code[m] in ' \t\n\r':
                    m += 1
                if m + 1 < n and code[m] == '=' and code[m+1] == '>':
                    params = code[i+1:end]
                    typed = annotate_params(params)
                    result.append('(')
                    result.append(typed)
                    result.append(')')
                    i = end + 1
                    matched = True

        if not matched:
            result.append(c)
            i += 1

    return ''.join(result)


def find_method_names(content):
    """Find all method names defined in the class body to exclude from field declarations."""
    methods = set()
    ctrl = {'if', 'for', 'while', 'switch', 'catch', 'with', 'return', 'typeof',
            'function', 'new', 'delete', 'void', 'in', 'instanceof', 'do', 'else',
            'try', 'finally', 'throw', 'class', 'extends', 'super', 'import',
            'export', 'from', 'as', 'default', 'await', 'yield', 'async'}
    # Match method definitions at class body indentation: "  methodName(...) {" or "  async methodName(...) {"
    pattern = re.compile(
        r'^[ \t]+(?:async\s+|static\s+|get\s+|set\s+)*(_?\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)\s*(?::\s*[^{=]+)?\s*(?:\{|=>)',
        re.MULTILINE
    )
    for m in pattern.finditer(content):
        name = m.group(1)
        if name not in ctrl:
            methods.add(name)
    return methods


def add_missing_global_declarations(content):
    """Add `declare const X: any;` for ES2024+ globals used as values."""
    decls = []
    # Iterator is a type in ES2022 lib but used as value in JS (typeof Iterator !== 'undefined')
    if re.search(r'\bIterator\b(?!\s*[,<\s])', content) and re.search(r'typeof\s+Iterator|Iterator\.from|Iterator\.', content):
        decls.append('declare const Iterator: any;')
    if re.search(r'\bDisposableStack\b', content):
        decls.append('declare const DisposableStack: any;')
    if re.search(r'\bAsyncDisposableStack\b', content):
        decls.append('declare const AsyncDisposableStack: any;')
    if re.search(r'\bInputDeviceCapabilities\b', content):
        decls.append('declare const InputDeviceCapabilities: any;')
    if re.search(r'\bFileSystemHandle\b', content) and re.search(r'typeof\s+FileSystemHandle|instanceof\s+FileSystemHandle', content):
        decls.append('declare const FileSystemHandle: any;')

    if decls:
        block = '// Type shims for newer ES globals used as values\n' + '\n'.join(decls) + '\n\n'
        # Insert before the first export interface or export class
        content = re.sub(
            r'(export\s+interface\s+\w+Props)',
            block + r'\1',
            content,
            count=1,
        )
    return content


def fix_catch_params(content):
    """Add :any to catch parameters (strict mode makes them 'unknown')."""
    # catch (err) -> catch (err: any)
    content = re.sub(r'\bcatch\s*\(\s*(\w+)\s*\)', r'catch (\1: any)', content)
    return content


def fix_typeof_fallback(content):
    """Cast `typeof X !== 'undefined' ? X : {}` fallback to any to allow property access."""
    # Replace `: {}` with `: ({} as any)` in typeof ternary
    content = re.sub(
        r'(typeof\s+\w+\s*!==\s*[\'"]undefined[\'"]\s*\?\s*\w+\s*:\s*)\{\}',
        r'\1({} as any)',
        content,
    )
    # Also handle `typeof X !== 'undefined' && X` patterns where X is navigator/document/window
    # by casting the result variable to any
    return content


def fix_indexed_this_access(content):
    """Convert `this[key]` to `(this as any)[key]` to avoid TS7053."""
    # Pattern: this[expr] where expr is a dynamic key (not a literal string)
    # Only convert when key is a variable/expression, not a string literal
    def replacer(m):
        prefix = m.group(1)
        key = m.group(2)
        # Skip if key is a string literal (this['foo'] is fine)
        if key.startswith("'") or key.startswith('"') or key.startswith('`'):
            return m.group(0)
        return f'{prefix}(this as any)[{key}]'

    content = re.sub(r'(this)\[([^\]]+)\]', replacer, content)
    return content


def fix_implicit_any_arrays(content):
    """Add type annotation to `let x = []` patterns."""
    # let x = [] -> let x: any[] = []
    content = re.sub(r'\blet\s+(\w+)\s*=\s*\[\]\s*;', r'let \1: any[] = [];', content)
    # const x = [] -> const x: any[] = []
    content = re.sub(r'\bconst\s+(\w+)\s*=\s*\[\]\s*;', r'const \1: any[] = [];', content)
    return content


def convert_file(js_path, ts_path):
    with open(js_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find class name
    class_match = re.search(r'export\s+class\s+(\w+)\s+extends\s+Page\s*\{', content)
    if not class_match:
        print(f'  SKIP (no Page class): {js_path}')
        return False
    class_name = class_match.group(1)

    # 1. Add type-only import for Props, State (if not present)
    if "from '../../core/types.js'" not in content:
        lines = content.split('\n')
        last_import_idx = -1
        for idx, line in enumerate(lines):
            if line.startswith('import '):
                last_import_idx = idx
        if last_import_idx >= 0:
            lines.insert(last_import_idx + 1, "import type { Props, State } from '../../core/types.js';")
            content = '\n'.join(lines)

    # 2. Add interfaces before class declaration
    interfaces = (
        f'export interface {class_name}Props extends Props {{}}\n\n'
        f'export interface {class_name}State extends State {{}}\n\n'
    )
    content = re.sub(
        r'(export\s+class\s+' + re.escape(class_name) + r'\s+extends\s+Page\s*\{)',
        interfaces + r'\1',
        content,
        count=1,
    )

    # 3. Add `declare props` and `declare state` right after class {
    content = re.sub(
        r'(export\s+class\s+' + re.escape(class_name) + r'\s+extends\s+Page\s*\{)\n',
        r'\1\n  declare props: ' + class_name + 'Props;\n  declare state: ' + class_name + 'State;\n',
        content,
        count=1,
    )

    # 4. Find all this._xxx references and declare fields
    field_pattern = re.compile(r'this\.(_\w+)\b')
    all_fields = set()
    for m in field_pattern.finditer(content):
        all_fields.add(m.group(1))

    # Exclude method names (defined as class methods) from field declarations
    method_names = find_method_names(content)
    all_fields = all_fields - method_names

    field_decls = []
    for field in sorted(all_fields):
        # Find first assignment: this._xxx = ...;
        assign_pattern = re.compile(r'this\.' + re.escape(field) + r'\s*=\s*([^;\n]+);')
        m = assign_pattern.search(content)
        if m:
            expr = m.group(1)
            field_type = infer_field_type(field, expr)
        else:
            field_type = 'any'
        # Initialize booleans to false, others to null
        if field_type == 'boolean':
            field_decls.append(f'  {field}: {field_type} = false;')
        else:
            field_decls.append(f'  {field}: {field_type} = null;')

    # Insert field declarations after `declare state: ...;`
    if field_decls:
        fields_block = '\n'.join(field_decls) + '\n'
        content = re.sub(
            r'(declare\s+state:\s*' + re.escape(class_name) + r'State;\n)',
            r'\1' + fields_block,
            content,
            count=1,
        )

    # 5. Add :any to all untyped parameters (methods, arrow functions, callbacks)
    content = add_param_types_to_code(content)

    # 6. Add explicit return types to override methods
    # renderPage(): Node | string | (Node | string)[]
    content = re.sub(
        r'(renderPage\s*\([^)]*\)\s*\{)',
        lambda m: _insert_return_type(m, 'Node | string | (Node | string)[]'),
        content,
    )
    # initialState(): <class>State
    content = re.sub(
        r'(initialState\s*\([^)]*\)\s*\{)',
        lambda m: _insert_return_type(m, f'{class_name}State'),
        content,
    )
    # componentDidMount(): void
    content = re.sub(
        r'(componentDidMount\s*\([^)]*\)\s*\{)',
        lambda m: _insert_return_type(m, 'void'),
        content,
    )
    # componentWillUnmount(): void
    content = re.sub(
        r'(componentWillUnmount\s*\([^)]*\)\s*\{)',
        lambda m: _insert_return_type(m, 'void'),
        content,
    )

    # 7. Post-processing fixes for strict mode compliance
    # 7a. Add :any to catch parameters (strict mode makes them 'unknown')
    content = fix_catch_params(content)
    # 7b. Cast typeof X ? X : {} fallback to any
    content = fix_typeof_fallback(content)
    # 7c. Add declare const for missing ES2024+ globals
    content = add_missing_global_declarations(content)
    # 7d. Convert this[key] to (this as any)[key] for dynamic indexed access
    content = fix_indexed_this_access(content)
    # 7e. Add type annotations to implicit any[] variables
    content = fix_implicit_any_arrays(content)

    with open(ts_path, 'w', encoding='utf-8') as f:
        f.write(content)
    return True


def _insert_return_type(m, ret_type):
    """Given a match like 'methodName(params) {', insert return type before {."""
    s = m.group(1)
    # s ends with '{'
    # Replace '{' with ': retType {'
    return s[:-1].rstrip() + ': ' + ret_type + ' {'


def main():
    os.makedirs(DST_DIR, exist_ok=True)
    converted = []
    skipped = []
    for js_name in FILES:
        js_path = os.path.join(SRC_DIR, js_name)
        if not os.path.exists(js_path):
            print(f'SKIP (not found): {js_name}')
            skipped.append(js_name)
            continue
        # Check if TS already exists (skip per task instructions for StreamsPage/FileAPIDeepPage)
        ts_name = out_name(js_name)
        ts_path = os.path.join(DST_DIR, ts_name)
        # Special: FileAPIDeepPage doesn't exist, we convert FileAccessPage.js -> FileAccessPage.ts
        # Special: StreamsPage.js -> StreamsPage.ts (create it)
        ok = convert_file(js_path, ts_path)
        if ok:
            converted.append(ts_name)
            print(f'  OK: {js_name} -> {ts_name}')
    print(f'\nConverted: {len(converted)}, Skipped: {len(skipped)}')


if __name__ == '__main__':
    main()
