#!/usr/bin/env node
/**
 * Pre-build script: automatically convert jQuery `$("#luckysheet-...")` calls
 * to `ls$("#luckysheet-...")` across all JS source files, and inject the import.
 *
 * Run before `npm run build:vite` or `npm run build`.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const SRC_DIR = join(process.cwd(), "src");
const LS_JQUERY_REL = "src/sdk/ls-jquery.ts";

const LS_IMPORT_RE = /import\s+\{.*?\bls\$[^}]*\}\s+from\s+['"]([^'"]*ls-jquery[^'"]*)['"];?/;

function resolveLsJqueryPath(fileDir) {
  return relative(fileDir, LS_JQUERY_REL).replace(/\\/g, "/").replace(/^\.\//, "");
}

function isExemptSelector(selector) {
  const trimmed = selector.trim();
  return (
    trimmed === "document" ||
    trimmed === "window" ||
    trimmed === "this" ||
    trimmed.startsWith("<!") ||
    /^<[a-zA-Z]/.test(trimmed)
  );
}

function transformFile(filePath) {
  let code = readFileSync(filePath, "utf8");

  if (!/#luckysheet-[\w-]+/.test(code)) {
    return false;
  }

  const fileDir = dirname(filePath);
  const relPath = resolveLsJqueryPath(fileDir);

  // 1) Inject ls$ import if not present
  if (!LS_IMPORT_RE.test(code)) {
    const importLine = `import { ls$ } from '${relPath}';`;
    const lastImportMatch = code.match(/^(\s*import\s+.*?;\s*)+/m);
    if (lastImportMatch) {
      const insertAt = lastImportMatch.index + lastImportMatch[0].length;
      code =
        code.slice(0, insertAt) +
        importLine +
        "\n" +
        code.slice(insertAt);
    } else {
      code = importLine + "\n" + code;
    }
  }

  // 2) Replace $("selector"), $('selector'), $(\`selector\`) with ls$()
  //    where selector contains #luckysheet-.
  //    Also handle string concatenation: $("string" + var + "string")
  //    Skip if already ls$(...
  code = code.replace(
    /(?<!ls)\$\(\s*(['"`])((?:(?!\1).)*#luckysheet-[\w-][^)]*)\1[^)]*\)/g,
    (match, _quote, selector) => {
      if (isExemptSelector(selector)) return match;
      return match.replace(/^\$\(/, "ls$(");
    }
  );

  // 3) Replace jQuery method chains: .find("selector"), .closest(...), etc.
  //    Only when the entire selector is inside a single string literal.
  //    [^)`]* stops at first `)` or backtick to avoid consuming chained calls.
  const methods = [
    "find", "closest", "filter", "not", "is", "eq", "first", "last",
    "children", "parent", "parents", "siblings", "prev", "nextAll",
    "add", "end", "has", "nextUntil", "prevUntil", "parentsUntil",
  ];
  const methodsPattern = methods.join("|");
  const methodRegexStr =
    "\\.(" + methodsPattern + ")\\(\\s*(['\"`])[^)`]*#luckysheet-[\\w-][^)`]*\\2\\s*\\)";
  code = code.replace(
    new RegExp(methodRegexStr, "g"),
    (match, method, _quote, selector) => {
      if (isExemptSelector(selector)) return match;
      if (match.includes("ls$(")) return match;
      // .method("sel")  ->  .method(ls$("sel"))
      // The match is .method("sel") — replace .method( with .method(ls$(
      const replaced = match.replace(
        new RegExp("^\\." + method + "\\("),
        `.${method}(ls$(`  // adds `ls$( before the selector, the closing `)` stays
      );
      // But this removes the opening `(` before the selector, so we need
      // to add it back inside ls$:
      // .method("sel") -> .method(ls$("sel"))
      // The match.slice(method.length+2) gives us `("sel")`
      // We want `.method(ls$("sel"))`
      const prefix = match.slice(0, match.indexOf("(") + 1); // ".method("
      const rest = match.slice(match.indexOf("(") + 1);       // `"sel")`
      return `.${method}(ls$(${rest}`;  // adds `ls$( before `"sel")` -> ls$("sel")
    }
  );

  writeFileSync(filePath, code);
  return true;
}

function walk(dir) {
  let results = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (/\.(js|ts)$/.test(entry) && entry !== "ls-jquery.ts") {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk(SRC_DIR);
let modified = 0;
for (const file of files) {
  if (transformFile(file)) {
    modified++;
    console.log(`  transformed: ${relative(SRC_DIR, file)}`);
  }
}

console.log(`\nDone. Transformed ${modified} file(s).`);
