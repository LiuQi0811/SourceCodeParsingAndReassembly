// fixup-v7.mjs — Bulk-fix remaining TS errors based on tsc output.
// Reads /tmp/tsc-full.log, applies targeted fixes per error code & line content.
import { readFileSync, writeFileSync } from 'fs';

const errors = readFileSync('/tmp/tsc-full.log', 'utf8')
  .split('\n')
  .filter(Boolean)
  .map(line => {
    const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
    if (!m) return null;
    return { file: m[1], line: +m[2], col: +m[3], code: m[4], msg: m[5] };
  })
  .filter(Boolean);

// Group by file
const byFile = {};
for (const e of errors) {
  (byFile[e.file] ||= []).push(e);
}

let totalFixed = 0;

for (const [file, errs] of Object.entries(byFile)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let modified = false;

  // Sort errors by line descending so we can edit without shifting offsets
  errs.sort((a, b) => b.line - a.line || b.col - a.col);

  for (const e of errs) {
    const idx = e.line - 1;
    const line = lines[idx];
    if (!line) continue;

    let fixed = null;

    // --- TS2322: Type 'null' is not assignable to type 'string | Node' ---
    // Pattern: `return null;` in a function returning `Node | string`
    if (e.code === 'TS2322' && e.msg.includes("Type 'null' is not assignable to type 'string | Node'")) {
      // Replace `return null;` with `return '';`
      if (line.includes('return null;')) {
        fixed = line.replace('return null;', "return '';");
      }
      // Or `: null,` in an object/h() call — replace null with ''
      if (!fixed && line.trim() === 'null,' ) {
        fixed = line.replace('null,', "'',");
      }
      if (!fixed && line.trim() === 'null') {
        fixed = line.replace('null', "''");
      }
    }

    // --- TS2322: Type 'Node | null' is not assignable to type 'string | Node' ---
    if (e.code === 'TS2322' && e.msg.includes("Type 'Node | null' is not assignable to type 'string | Node'")) {
      // Add `as any` to the expression — find what's being returned/passed
      // Common pattern: `return this._someMethod();` where method returns Node | null
      // Or passing to h() as a child
      // Try: wrap the return value or add `!`
      if (line.includes('return ')) {
        fixed = line.replace(/return (.*);$/, 'return ($1 as any);');
      }
    }

    // --- TS2314: Generic type 'Set<T>' requires 1 type argument(s) ---
    if (e.code === 'TS2314' && e.msg.includes("Generic type 'Set<T>' requires 1 type argument")) {
      fixed = line.replace(/new Set\(\)/, 'new Set<any>()');
    }

    // --- TS2794: Expected 1 arguments, but got 0 (Promise resolver) ---
    if (e.code === 'TS2794' && e.msg.includes('Expected 1 arguments, but got 0')) {
      // Pattern: `resolve()` → `resolve(undefined)`
      if (line.includes('resolve()')) {
        fixed = line.replace('resolve()', 'resolve(undefined)');
      }
    }

    // --- TS2612: Property '_destroyed' will overwrite the base property ---
    if (e.code === 'TS2612' && e.msg.includes("will overwrite the base property")) {
      // Add `declare` modifier to the property declaration
      // Pattern: `  _destroyed!: boolean;` → `  declare _destroyed!: boolean;`
      const propMatch = e.msg.match(/Property '(\w+)'/);
      if (propMatch) {
        const propName = propMatch[1];
        // Match `  propName: type;` or `  propName!: type;` (with leading whitespace)
        const re = new RegExp(`^(\\s+)${propName}(!?\\s*:\\s*)`);
        if (re.test(line)) {
          fixed = line.replace(re, `$1declare ${propName}$2`);
        }
      }
    }

    // --- TS2355: A function whose declared type is neither 'undefined', 'void', nor 'any' must return a value ---
    if (e.code === 'TS2355') {
      // Add `return undefined;` at the end of the function
      // The error line is usually the closing `}` of the function
      // We need to add a return statement before the closing brace
      // Actually, the error points to the function declaration line or the closing brace
      // Let's check if this line is a closing brace
      if (line.trim() === '}') {
        // Insert return undefined; before this line
        const indent = line.match(/^(\s*)/)[1];
        lines[idx] = `${indent}return undefined;`;
        lines.splice(idx + 1, 0, line);
        fixed = '__inserted__';
      }
    }

    // --- TS18046: 'X' is of type 'unknown' ---
    if (e.code === 'TS18046' && e.msg.includes("is of type 'unknown'")) {
      const varMatch = e.msg.match("'(\\w+)' is of type 'unknown'");
      if (varMatch) {
        const varName = varMatch[1];
        // Try to find and cast the variable on this line
        // Pattern: `varName.something` → `(varName as any).something`
        // But only if the variable appears on this line
        if (line.includes(varName + '.') || line.includes(varName + ')') || line.includes(varName + ',')) {
          // Find the first occurrence and add `as any`
          // Be careful not to double-cast
          if (!line.includes(`${varName} as any`)) {
            fixed = line.replace(
              new RegExp(`\\b${varName}\\b(?!\\s+as\\s+any)`),
              `${varName} as any`
            );
          }
        }
      }
    }

    // --- TS18047: 'X' is possibly 'null' ---
    if (e.code === 'TS18047' && e.msg.includes("is possibly 'null'")) {
      const varMatch = e.msg.match("'(\\w+)' is possibly 'null'");
      if (varMatch) {
        const varName = varMatch[1];
        // Add `!` after the variable name on this line
        if (line.includes(varName + '.') && !line.includes(varName + '!')) {
          fixed = line.replace(
            new RegExp(`\\b${varName}\\.(?!)`),
            `${varName}!.`
          );
        }
      }
    }

    // --- TS18048: 'X' is possibly 'undefined' ---
    if (e.code === 'TS18048' && e.msg.includes("is possibly 'undefined'")) {
      const varMatch = e.msg.match("'(\\w+)' is possibly 'undefined'");
      if (varMatch) {
        const varName = varMatch[1];
        if (line.includes(varName + '.') && !line.includes(varName + '!') && !line.includes(varName + '?.')) {
          fixed = line.replace(
            new RegExp(`\\b${varName}\\.(?!)`),
            `${varName}!.`
          );
        }
      }
    }

    // --- TS2683: 'this' implicitly has type 'any' ---
    if (e.code === 'TS2683' && e.msg.includes("'this' implicitly has type 'any'")) {
      // Add `: any` to the function parameter list or arrow function
      // This is tricky - skip for now, handle manually
    }

    // --- TS7006: Parameter 'X' implicitly has an 'any' type ---
    if (e.code === 'TS7006' && e.msg.includes("implicitly has an 'any' type")) {
      const paramMatch = e.msg.match("Parameter '(\\w+)' implicitly has an 'any' type");
      if (paramMatch) {
        const paramName = paramMatch[1];
        // Add `: any` after the parameter name
        // Pattern: `(paramName)` or `(paramName,` or `, paramName)` or `, paramName,`
        const re = new RegExp(`\\b${paramName}\\b(?!\\s*:)`);
        if (re.test(line)) {
          fixed = line.replace(re, `${paramName}: any`);
        }
      }
    }

    // --- TS7019: Rest parameter 'args' implicitly has an 'any[]' type ---
    if (e.code === 'TS7019') {
      fixed = line.replace(/\.\.\.(\w+)\)/, '...$1: any[])');
    }

    // --- TS7057: 'yield' expression implicitly results in an 'any' type ---
    if (e.code === 'TS7057') {
      // Add return type annotation to the generator function
      // This requires finding the function declaration - skip for now
    }

    // --- TS2304: Cannot find name 'X' ---
    if (e.code === 'TS2304' && e.msg.includes("Cannot find name")) {
      const nameMatch = e.msg.match("Cannot find name '(\\w+)'");
      if (nameMatch) {
        const name = nameMatch[1];
        if (name === 'State') {
          // Need to add import - handle by adding `import type { State } from '../../core/types.js';`
          // Skip for now, handle manually
        }
        if (name === 'code' || name === 'appHash') {
          // These are in template literals - replace with `$\{...}` variable
          // Skip for now, handle manually
        }
        if (name === 'clients') {
          // In Worker context - replace with `self.clients` or `(self as any).clients`
          fixed = line.replace(/\bclients\b/, '(self as any).clients');
        }
      }
    }

    // --- TS2552: Cannot find name 'X'. Did you mean 'Y'? ---
    if (e.code === 'TS2552' && e.msg.includes("Cannot find name 'clients'")) {
      fixed = line.replace(/\bclients\b/, '(self as any).clients');
    }

    // --- TS2504: Type 'Promise<AsyncIterable<string>>' must have a '[Symbol.asyncIterator]()' method ---
    if (e.code === 'TS2504' && e.msg.includes('asyncIterator')) {
      // Cast to AsyncIterable
      // Pattern: `await xxx.promptStreaming()` → `(await xxx.promptStreaming()) as any`
      // Skip for now
    }

    // --- TS2547: The type returned by the 'next()' method must be a promise for a type with a 'value' property ---
    if (e.code === 'TS2547') {
      // Skip - needs manual fix
    }

    if (fixed && fixed !== '__inserted__') {
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
console.log('Note: Some errors need manual fixes. Run tsc again to see remaining.');
