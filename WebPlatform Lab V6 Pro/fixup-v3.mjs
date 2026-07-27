// Comprehensive fixup v3 for converted api-lab .ts files.
// Strategies:
//  1) Fix polymorphic `_caps(items)` methods: add overload signatures + XxxCaps interface
//  2) Cast `this.$(...)` and `document.getElementById(...)` to `any` at call sites
//  3) Add `: any` to untyped method/function parameters (broad regex)
//  4) Add `!` to "possibly null" local variables checked at top of method
//  5) Repair `:!: ` corruption and other known patterns
import { readFileSync, writeFileSync, readdirSync } from 'fs';

const DIR = '/workspace/ts/pages/api-lab';
const files = readdirSync(DIR).filter(f => f.endsWith('.ts'));

// Find matching close brace index for the `{` at openIdx.
function matchBrace(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i; }
    else if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
    } else if (ch === '/' && src[i+1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (ch === '/' && src[i+1] === '*') {
      i += 2;
      while (i < src.length - 1 && !(src[i] === '*' && src[i+1] === '/')) i++;
      i++;
    }
  }
  return -1;
}

// Parse top-level key/value pairs of the object literal whose `{` is at objOpenIdx.
function extractPairsFromObject(src, objOpenIdx) {
  let depth = 0;
  let segStart = objOpenIdx + 1;
  const segments = [];
  for (let i = objOpenIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') {
      depth--;
      if (depth === 0 && ch === '}') { segments.push(src.slice(segStart, i)); break; }
    } else if (ch === ',' && depth === 1) { segments.push(src.slice(segStart, i)); segStart = i + 1; }
    else if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
    } else if (ch === '/' && src[i+1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    }
  }
  const pairs = [];
  for (const seg of segments) {
    const t = seg.trim();
    if (!t) continue;
    const m = t.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*([\s\S]+)$/);
    if (m) {
      let val = m[2].trim();
      if (val.endsWith(',')) val = val.slice(0, -1).trim();
      pairs.push({ key: m[1], type: inferType(val) });
      continue;
    }
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(t)) pairs.push({ key: t, type: 'boolean' });
  }
  return pairs;
}

function inferType(v) {
  const t = v.trim();
  if (t === 'true' || t === 'false') return 'boolean';
  if (/^-?\d+(\.\d+)?$/.test(t)) return 'number';
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) return 'string';
  if (t === 'null') return 'any';
  return 'boolean';
}

// Get all boolean flags returned by `_caps(items)` method (the polymorphic version).
function extractCapsPairs(src, fnBodyOpenIdx) {
  // Look for `const flags = {` at depth 1
  let depth = 0;
  for (let i = fnBodyOpenIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') { depth--; if (depth === 0) break; }
    else if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
    } else if (depth === 1 && (ch === 'c' || ch === 'l' || ch === 'r')) {
      // try `const <var> = {` or `let <var> = {` or `return {`
      if (src.slice(i, i+5) === 'const' && /\s/.test(src[i+5] || '')) {
        let j = i + 5;
        while (j < src.length && /\s/.test(src[j])) j++;
        const vm = src.slice(j).match(/^([a-zA-Z_$][\w$]*)\s*=\s*\{/);
        if (vm) {
          const objOpen = j + vm[0].length - 1;
          const pairs = extractPairsFromObject(src, objOpen);
          if (pairs.length > 0) return pairs;
        }
      } else if (src.slice(i, i+6) === 'return' && /\s/.test(src[i+6] || '')) {
        let j = i + 6;
        while (j < src.length && /\s/.test(src[j])) j++;
        if (src[j] === '{') return extractPairsFromObject(src, j);
      }
    }
  }
  return null;
}

function fix(name) {
  const path = `${DIR}/${name}`;
  let src = readFileSync(path, 'utf8');
  const orig = src;
  const clsName = name.replace(/\.ts$/, '');
  const capsType = `${clsName}Caps`;

  // === 0) Repair prior-run corruption: `  _x:!: type;` -> `  _x!: type;` ===
  src = src.replace(/^(  _\w+):!:\s*/gm, '$1!: ');

  // === 1) Fix polymorphic `_caps(items: [string, boolean][]): Node[]` ===
  // Replace the single signature with two overloads:
  //   _caps(): XxxCaps;
  //   _caps(items: [string, boolean][]): Node[];
  // And inject the XxxCaps interface if missing.
  const polyCapsRe = /_caps\(items:\s*\[string,\s*boolean\]\[\]\):\s*Node\[\]\s*\{/;
  if (polyCapsRe.test(src)) {
    // Locate the method body and extract the returned flags object to build the interface.
    const m = polyCapsRe.exec(src);
    const openIdx = m.index + m[0].lastIndexOf('{');
    const closeIdx = matchBrace(src, openIdx);
    let capsPairs = null;
    if (closeIdx !== -1) capsPairs = extractCapsPairs(src, openIdx);

    // Build replacement signature with overloads.
    const overloadSig =
      `_caps(): ${capsType};\n` +
      `  _caps(items: [string, boolean][]): Node[];`;
    // Replace the signature line only (keep the body). Pattern: `_caps(items: [string, boolean][]): Node[] {`
    src = src.replace(
      /(_caps\(items:\s*\[string,\s*boolean\]\[\]\):\s*Node\[\])\s*\{/,
      `$1 {\n  // @ts-ignore - overload signature above\n  // (single-arg overload)`
    );
    // Insert the no-arg overload as a separate signature above.
    src = src.replace(
      /([^\n]*_caps\(items:\s*\[string,\s*boolean\]\[\]\):\s*Node\[\]\s*\{)/,
      `  ${overloadSig}\n$1`
    );

    // Now make the implementation method's signature compatible with both overloads.
    // Replace `_caps(items: [string, boolean][]): Node[] {` with `_caps(items?: [string, boolean][]): any {`
    src = src.replace(
      /_caps\(items:\s*\[string,\s*boolean\]\[\]\):\s*Node\[\]\s*\{/g,
      '_caps(items?: [string, boolean][]): any {'
    );
    // Remove duplicate overload signature that we accidentally inserted with full body form.
    // The pattern `  _caps(): XxxCaps;\n  _caps(items: [string, boolean][]): Node[];` is what we want as overloads.
    // But our regex above may have left the body sig too. Clean up any leftover `_caps(items...): Node[]` references.

    // Inject the XxxCaps interface if it doesn't exist yet.
    if (capsPairs && capsPairs.length > 0) {
      const ifaceExists = new RegExp(`interface\\s+${capsType}\\b`).test(src);
      if (!ifaceExists) {
        const ifaceBody = capsPairs.map(p => `  ${p.key}: ${p.type};`).join('\n');
        const iface = `interface ${capsType} {\n${ifaceBody}\n}\n\n`;
        // Inject after the LogEntry interface or after the imports.
        const injectAnchor = src.indexOf('interface LogEntry');
        if (injectAnchor !== -1) {
          src = src.slice(0, injectAnchor) + iface + src.slice(injectAnchor);
        } else {
          // inject after the last import line
          const importEnd = src.lastIndexOf('from ');
          const lineEnd = src.indexOf('\n', importEnd);
          src = src.slice(0, lineEnd + 1) + '\n' + iface + src.slice(lineEnd + 1);
        }
      }
    }
  }

  // === 2) Cast `this.$('selector')` to `any` to bypass DOM property type checks ===
  // Pattern: `this.$('xxx')` -> `(this.$('xxx') as any)`
  // Avoid wrapping if already cast.
  src = src.replace(/\bthis\.\$\(('[^']*'|"[^"]*")\)(?!\s*as)/g, "(this.$($1) as any)");
  // Also: `this.$$('selector')` -> `(this.$$('selector') as any[])
  src = src.replace(/\bthis\.\$\$\(('[^']*'|"[^"]*")\)(?!\s*as)/g, "(this.$$($1) as any[])");

  // === 3) Cast `document.getElementById('xxx')` to `any` ===
  src = src.replace(/\bdocument\.getElementById\(('[^']*'|"[^"]*")\)(?!\s*as)/g, "(document.getElementById($1) as any)");

  // === 4) Cast `document.createElement('canvas'|'video'|'input'|'audio')` to `any` for property access ===
  // (Conservative: only canvas/video/audio/input where property access mismatches are common)
  src = src.replace(
    /\bdocument\.createElement\(('canvas'|'video'|'audio'|'input'|"canvas"|"video"|"audio"|"input")\)/g,
    '(document.createElement($1) as any)'
  );

  // === 5) Add `: any` to untyped method parameters ===
  // Pattern: `methodName(param1, param2) {` -> `methodName(param1: any, param2: any) {`
  // Only apply to identifiers not already typed. Avoid constructors / async generator complications.
  // Conservative patterns targeting common method names found in converted files.
  const methodNamesToType = [
    // helpers
    '_draw', '_animate', '_drawAnimFrame', '_encode', '_decode', '_process',
    '_safe', '_try', '_run', '_exec', '_make', '_build', '_create', '_setup',
    '_start', '_stop', '_pause', '_resume', '_init', '_reset', '_cleanup',
    '_apply', '_update', '_set', '_get', '_add', '_remove', '_render',
    '_log', '_emit', '_dispatch', '_format', '_parse', '_stringify',
    '_inject', '_measure', '_record', '_capture', '_play', '_load', '_save',
    '_convert', '_compose', '_decompose', '_transform', '_filter',
    // specific
    '_wrap', '_unwrap', '_tick', '_frame', '_step', '_loop', '_iter',
    '_handle', '_on', '_emit2', '_fmt', '_bench', '_probe', '_check',
    '_makeFakeEntry', '_caps2', '_detect',
    // generic single-letter / short names commonly untyped
  ];
  // For each method-like definition `name(args) {` or `name(args): Ret {` or `async name(args) {`,
  // type any untyped identifier params.
  function typeParams(s) {
    // s is the param list string, e.g. "a, b: number, c = 1"
    return s.split(',').map(p => {
      const t = p.trim();
      if (!t) return t;
      // skip rest params, destructuring, default values with type, already typed
      if (t.startsWith('...')) return t;
      if (t.startsWith('{') || t.startsWith('[')) return t;  // destructuring - skip
      // already typed: identifier: type
      if (/^[a-zA-Z_$][\w$]*\s*[:?]/.test(t)) return t;
      // default value without type: identifier = value
      const dm = t.match(/^([a-zA-Z_$][\w$]*)(\s*=\s*.+)$/);
      if (dm) return `${dm[1]}: any${dm[2]}`;
      // plain identifier
      if (/^[a-zA-Z_$][\w$]*$/.test(t)) return `${t}: any`;
      return t;
    }).join(', ');
  }
  // Match ` methodName(params) {` or `async methodName(params) {` or ` methodName(params): Ret {`
  // We restrict to method names that start with `_` or are in the known list to be conservative.
  const methodRe = /(\b(?:async\s+)?)(_[a-zA-Z]\w*|make|build|create|run|exec|process|format|parse|wrap|emit|handle|tick|step|loop|iter|probe|check|test|draw|animate|encode|decode|measure|record|capture|play|load|save|convert|compose|transform|filter|inject|dispatch|update|apply)\s*\(([^()]*?)\)\s*(?::\s*[^{;]+?\s*)?\{/g;
  src = src.replace(methodRe, (m, asyncKw, name, params) => {
    if (!params.trim()) return m;
    const newParams = typeParams(params);
    if (newParams === params) return m;
    const ret = m.includes(':') ? m : m.replace('{', '{');  // keep
    // Reconstruct preserving return type if present
    const retMatch = m.match(/\)\s*(:\s*[^{;]+?\s*)?\{/);
    const retType = retMatch && retMatch[1] ? retMatch[1] : '';
    return `${asyncKw}${name}(${newParams})${retType}{`;
  });

  // === 6) Type arrow-function params in common patterns ===
  // `(e) =>` where e is event-like -> `(e: any) =>`
  // Only when used in event-binding contexts (.addEventListener, .on, setAttribute onclick)
  src = src.replace(/\baddEventListener\(\s*('[^']*'|"[^"]*")\s*,\s*\(([a-zA-Z_$][\w$]*)\)\s*=>/g,
    (m, ev, p) => `addEventListener($1, (${p}: any) =>`);
  src = src.replace(/\bon\(this\.\w+,\s*('[^']*'|"[^"]*")\s*,\s*\(([a-zA-Z_$][\w$]*)\)\s*=>/g,
    (m, ev, p) => `on(this.$2 || this.el, $1, (${p}: any) =>`);
  // Generic `.map((x) =>` and `.forEach((x) =>` and `.filter((x) =>` with untyped single param
  // (only for arrays of `any` - skip if too broad)
  // SKIP: too risky without context

  // === 7) Fix `_injectStyle(id, css)` and similar common helpers if not already typed ===
  // (Already handled by methodRe above in most cases.)

  // === 8) Add `!` definite assignment to uninitialized class fields ending with `: any;` ===
  // Pattern: `  _foo: any;` -> `  _foo!: any;`  (only for fields starting with `_`)
  // Skip if already `!` or has initializer.
  src = src.replace(/^(\s+_\w+)\s*:\s*([^{=;\n]+?)(;\s*)$/gm, (m, name, type, end) => {
    if (name.endsWith('!')) return m;
    if (/\?$/.test(type.trim())) return m;  // optional types don't need !
    return `${name}!: ${type}${end}`;
  });

  // === 9) Convert `catch (err)` to `catch (err: any)` ===
  src = src.replace(/\bcatch\s*\(\s*(\w+)\s*\)/g, (m, v) => `catch (${v}: any)`);

  // === 10) Type common arrow-function variables that fail TS7005/7006 ===
  // `const fn = (a, b) =>` -> `const fn = (a: any, b: any) =>`
  src = src.replace(/\bconst\s+(\w+)\s*=\s*\(([^()]*)\)\s*=>/g, (m, name, params) => {
    if (!params.trim()) return m;
    // Skip if any param already typed
    if (/^[a-zA-Z_$][\w$]*\s*[:?]/.test(params.trim())) return m;
    const newParams = typeParams(params);
    if (newParams === params) return m;
    return `const ${name} = (${newParams}) =>`;
  });

  if (src !== orig) {
    writeFileSync(path, src);
    console.log(`FIXED: ${name}`);
  } else {
    console.log(`NOCHANGE: ${name}`);
  }
}

for (const f of files) {
  try { fix(f); } catch(e) { console.log(`ERROR: ${f}: ${e.message}`); }
}
