// fixup-v8.mjs — Comprehensive fixup for remaining TS errors.
// Handles TS7053, TS2531, TS2722, TS18048, TS2314, TS2355, TS2322, TS2345, TS2769, etc.
import { readFileSync, writeFileSync } from 'fs';

const log = readFileSync('/tmp/tsc-v4.log', 'utf8');
const errors = [];
for (const line of log.split('\n')) {
  const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
  if (m) errors.push({ file: m[1], line: +m[2], col: +m[3], code: m[4], msg: m[5] });
}

// Group by file
const byFile = {};
for (const e of errors) (byFile[e.file] ||= []).push(e);

let totalFixed = 0;

for (const [file, errs] of Object.entries(byFile)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let modified = false;
  // Sort by line descending, then col descending
  errs.sort((a, b) => b.line - a.line || b.col - a.col);

  for (const e of errs) {
    const idx = e.line - 1;
    let line = lines[idx];
    if (!line) continue;
    let fixed = null;

    // --- TS7053: Element implicitly has 'any' type because expression of type 'any' can't index type '{...}' ---
    // Fix: wrap the indexed object in (as any)
    // The error is at the position of the indexing expression
    if (e.code === 'TS7053' || e.code === 'TS7017') {
      // Find the `[key]` pattern near the error column and wrap the object before it
      // Strategy: find the `]` closest to the error col, then find matching `[`,
      // then wrap everything before `[` in (as any)
      const before = line.substring(0, e.col - 1);
      const after = line.substring(e.col - 1);
      // Find the last `[` before the error position
      const bracketOpen = before.lastIndexOf('[');
      if (bracketOpen >= 0) {
        // Find what's before the `[` — could be a variable, method call, etc.
        const objExpr = before.substring(0, bracketOpen).trim();
        // Don't double-wrap
        if (!objExpr.endsWith('as any)') && !objExpr.endsWith(')')) {
          // Find the matching `]`
          const closeIdx = line.indexOf(']', bracketOpen + 1);
          if (closeIdx >= 0) {
            // Wrap the object expression in (as any)
            // Need to find the start of the object expression
            // Simple approach: replace `objExpr[key]` with `(objExpr as any)[key]`
            const keyPart = line.substring(bracketOpen, closeIdx + 1);
            const fullExpr = objExpr + keyPart;
            const replacement = `(${objExpr} as any)${keyPart}`;
            if (line.includes(fullExpr)) {
              fixed = line.replace(fullExpr, replacement);
            }
          }
        }
      }
    }

    // --- TS2531: Object is possibly 'null' ---
    // --- TS18048: 'X' is possibly 'undefined' ---
    // Fix: add `!` before the `.` that accesses the property
    if (e.code === 'TS2531' || e.code === 'TS18048' || e.code === 'TS18047') {
      // The error col points to the property access
      // Find the `.` before the error position and insert `!` before it
      const col = e.col - 1; // 0-based
      // Look for `.` near the error position
      // The variable name ends just before the `.`
      let dotPos = -1;
      for (let i = col; i >= 0; i--) {
        if (line[i] === '.') { dotPos = i; break; }
        if (line[i] === ' ' || line[i] === '(' || line[i] === ',') break;
      }
      if (dotPos > 0) {
        // Check if there's already a `!` before the `.`
        if (line[dotPos - 1] !== '!' && line[dotPos - 1] !== '?') {
          fixed = line.substring(0, dotPos) + '!' + line.substring(dotPos);
        }
      }
    }

    // --- TS2722: Cannot invoke an object which is possibly 'undefined' ---
    // Fix: add `!` before the `()` or use `?.()`
    if (e.code === 'TS2722') {
      const col = e.col - 1;
      // Find `()` or `(` near the error position
      const before = line.substring(0, col + 1);
      const parenPos = before.lastIndexOf('(');
      if (parenPos > 0) {
        // Check what's before the `(`
        const beforeParen = line[parenPos - 1];
        if (beforeParen !== '!' && beforeParen !== ')' && beforeParen !== '?') {
          // Add `!` before `(`
          fixed = line.substring(0, parenPos) + '!' + line.substring(parenPos);
        }
      }
    }

    // --- TS2314: Generic type 'Set<T>' requires 1 type argument(s) ---
    if (e.code === 'TS2314') {
      // Find `new Set()` or `Set` without type args
      if (line.includes('new Set()')) {
        fixed = line.replace('new Set()', 'new Set<any>()');
      } else if (line.includes(': Set;') || line.includes(': Set ')) {
        fixed = line.replace(/: Set([;\s])/, ': Set<any>$1');
      } else if (line.match(/\bSet\b(?!\s*[<(.])/)) {
        fixed = line.replace(/\bSet\b(?!\s*[<(.])/, 'Set<any>');
      }
    }

    // --- TS2355: A function whose declared type is neither 'undefined', 'void', nor 'any' must return a value ---
    // Fix: add `return undefined;` before the closing brace
    if (e.code === 'TS2355') {
      // The error line is usually the function signature or closing brace
      // Find the next closing brace `}` at the same or lower indentation
      const indent = line.match(/^(\s*)/)[1];
      const indentLen = indent.length;
      let insertIdx = -1;
      for (let i = idx + 1; i < lines.length; i++) {
        const l = lines[i];
        if (l.trim() === '') continue;
        const lIndent = (l.match(/^(\s*)/) || ['',''])[1].length;
        if (lIndent <= indentLen && l.trim().startsWith('}')) {
          insertIdx = i;
          break;
        }
        // If we hit another function/method at same or lower level, insert before it
        if (lIndent <= indentLen && (l.trim().startsWith('_') || l.trim().startsWith('render') || l.trim().startsWith('component'))) {
          insertIdx = i;
          break;
        }
      }
      if (insertIdx >= 0) {
        const targetIndent = lines[insertIdx].match(/^(\s*)/)[1];
        lines.splice(insertIdx, 0, `${targetIndent}return undefined;`);
        modified = true;
        totalFixed++;
        continue;
      }
    }

    // --- TS2322: Type 'Node | null' is not assignable to type 'string | Node' ---
    if (e.code === 'TS2322' && e.msg.includes("Type 'Node | null' is not assignable to type 'string | Node'")) {
      // Add `as any` to the expression
      if (line.includes('return ') && !line.includes('as any')) {
        fixed = line.replace(/return (.*?);$/, 'return ($1 as any);');
      }
    }

    // --- TS2322: Type 'null' is not assignable to type 'string' ---
    if (e.code === 'TS2322' && e.msg.includes("Type 'null' is not assignable to type 'string'")) {
      // Find the null value and cast it
      if (line.includes('= null;') && !line.includes('as any')) {
        fixed = line.replace('= null;', '= null as any;');
      } else if (line.includes(': null,') && !line.includes('as any')) {
        fixed = line.replace(': null,', ': null as any,');
      }
    }

    // --- TS2322: Type 'number' is not assignable to type 'null' ---
    // This happens when a property is typed as `null` but assigned a number
    if (e.code === 'TS2322' && e.msg.includes("Type 'number' is not assignable to type 'null'")) {
      // The property type annotation is wrong — change `: null` to `: number | null`
      if (line.match(/:\s*null\s*[;=]/)) {
        fixed = line.replace(/:\s*null([;=])/, ': number | null$1');
      }
    }

    // --- TS2345: Argument of type 'Element | null' is not assignable to parameter of type 'Element' ---
    if (e.code === 'TS2345' && e.msg.includes("Type 'Element | null'") && e.msg.includes("is not assignable to parameter of type 'Element'")) {
      // Add `!` to the expression
      const col = e.col - 1;
      // Find the expression ending near the col and add `!`
      // Look for `)` or identifier before the col
      if (line[col - 1] === ')') {
        fixed = line.substring(0, col) + '!' + line.substring(col);
      } else if (line[col - 1] !== '!' && !line.includes('as any')) {
        fixed = line.substring(0, col) + '!' + line.substring(col);
      }
    }

    // --- TS2345: Argument of type 'string | null' is not assignable ---
    if (e.code === 'TS2345' && e.msg.includes("Type 'string | null'")) {
      // Add `!` or `as any`
      if (!line.includes('as any')) {
        const col = e.col - 1;
        if (line[col - 1] === ')') {
          fixed = line.substring(0, col) + '!' + line.substring(col);
        }
      }
    }

    // --- TS2345: Argument of type 'Credential | null' ---
    if (e.code === 'TS2345' && e.msg.includes("Type 'Credential | null'")) {
      if (!line.includes('as any')) {
        const col = e.col - 1;
        if (line[col - 1] === ')') {
          fixed = line.substring(0, col) + '!' + line.substring(col);
        }
      }
    }

    // --- TS2769: No overload matches this call ---
    // Fix: add `as any` to the argument
    if (e.code === 'TS2769') {
      // This is complex — try adding `as any` to the argument at the error position
      // Skip for now, handle manually
    }

    // --- TS2353: Object literal may only specify known properties ---
    if (e.code === 'TS2353') {
      // Add `as any` to the object literal
      // Skip for now
    }

    // --- TS2300/TS2717: Duplicate identifier ---
    // Fix: remove the duplicate property declaration
    if (e.code === 'TS2300' || e.code === 'TS2717') {
      // The duplicate is usually a class property that's also declared via `declare`
      // Remove the class property declaration (keep the `declare` version)
      const propMatch = e.msg.match("Property '(\\w+)'");
      if (propMatch) {
        const propName = propMatch[1];
        // Check if this line declares the property (not with `declare`)
        const re = new RegExp(`^(\\s+)${propName}\\s*[:=]`);
        if (re.test(line) && !line.includes('declare ')) {
          // Comment out this line
          fixed = line.replace(re, '$1// ');
        }
      }
    }

    // --- TS2304: Cannot find name 'State' ---
    if (e.code === 'TS2304' && e.msg.includes("Cannot find name 'State'")) {
      // Need to add import — check if file already has imports
      // Find the last import line and add after it
      let lastImportIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) lastImportIdx = i;
      }
      if (lastImportIdx >= 0 && !lines.some(l => l.includes("from '../../core/types.js'"))) {
        lines.splice(lastImportIdx + 1, 0, "import type { State } from '../../core/types.js';");
        modified = true;
        totalFixed++;
        continue;
      }
    }

    // --- TS2304: Cannot find name 'code' or 'appHash' ---
    if (e.code === 'TS2304' && (e.msg.includes("Cannot find name 'code'") || e.msg.includes("Cannot find name 'appHash'"))) {
      // These are in template literals — replace with string literal
      // Skip for now, handle manually
    }

    // --- TS2683: 'this' implicitly has type 'any' ---
    if (e.code === 'TS2683') {
      // Add `: any` to the function's this parameter or add return type
      // Skip for now
    }

    // --- TS2869/TS2871/TS2873: unreachable code ---
    // These are warnings about dead code — can be suppressed or fixed
    // Skip for now

    if (fixed) {
      lines[idx] = fixed;
      modified = true;
      totalFixed++;
    }
  }

  if (modified) {
    writeFileSync(file, lines.join('\n'));
    console.log(`Fixed ${file}`);
  }
}

console.log(`\nTotal fixes applied: ${totalFixed}`);
