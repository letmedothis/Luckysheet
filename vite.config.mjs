import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { defineConfig } from "vite";

const langs = (process.env.LUCKYSHEET_LANGS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const KNOWN_LANGS = ["en", "zh", "es", "zh_tw"];
for (const l of langs) {
    if (!KNOWN_LANGS.includes(l)) {
        throw new Error(`[vite] unknown LUCKYSHEET_LANGS entry: ${l}`);
    }
}

function slimLocalePlugin() {
    if (langs.length === 0) {
        return { name: "luckysheet-locale-noop" };
    }
    const genDir = resolve("node_modules/.cache/luckysheet-locale");
    const genFile = resolve(genDir, "active.js");
    const content =
        langs
            .map((l, i) => `import lang_${i} from ${JSON.stringify(resolve(`src/locale/${l}.js`))};`)
            .join("\n") +
        "\nexport default {" +
        langs.map((l, i) => `${JSON.stringify(l)}: lang_${i}`).join(", ") +
        "};\n";
    return {
        name: "luckysheet-slim-locale",
        enforce: "pre",
        buildStart() {
            mkdirSync(genDir, { recursive: true });
            writeFileSync(genFile, content);
        },
        resolveId(source, importer) {
            if (
                source === "./active" &&
                importer &&
                importer.replace(/\\/g, "/").endsWith("src/locale/locale.js")
            ) {
                return genFile;
            }
            return null;
        },
    };
}

function luckysheetInstanceSelectorPlugin() {
    const LS_IMPORT_RE = /import\s+\{.*?\bls\$[^}]*\}\s+from\s+['"]([^'"]*ls-jquery[^'"]*)['"];?/;

    function resolveLsJqueryPath(fileId) {
        const fileDir = fileId.includes("/") ? fileId.slice(0, fileId.lastIndexOf("/")) : ".";
        return relative(fileDir, "src/sdk/ls-jquery.ts")
            .replace(/\\/g, "/")
            .replace(/^\.\//, "");
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

    return {
        name: "luckysheet-instance-selector",
        enforce: "pre",
        transform(code, id) {
            if (!id.includes("/src/") || !/\.(js|ts)$/.test(id)) {
                return null;
            }
            if (id.replace(/\\/g, "/").endsWith("src/sdk/ls-jquery.ts")) {
                return null;
            }

            let transformed = code;

            if (!/#luckysheet-[\w-]+/.test(transformed)) {
                return null;
            }

            // 1) Inject the ls$ import once
            if (!LS_IMPORT_RE.test(transformed)) {
                const relPath = resolveLsJqueryPath(id);
                const importLine = `import { ls$ } from '${relPath}';`;
                const lastImportMatch = transformed.match(/^(\s*import\s+.*?;\s*)+/m);
                if (lastImportMatch) {
                    const insertAt = lastImportMatch.index + lastImportMatch[0].length;
                    transformed =
                        transformed.slice(0, insertAt) +
                        importLine +
                        "\n" +
                        transformed.slice(insertAt);
                } else {
                    transformed = importLine + "\n" + transformed;
                }
            }

            // 2) Replace $("selector"), $('selector') with ls$("selector"), ls$('selector')
            //    where the selector string contains a #luckysheet- ID.
            //    Also handles: $("prefix" + var + "#luckysheet-suffix")
            //    Uses negative lookbehind to skip calls already starting with ls$.
            transformed = transformed.replace(
                /(?<!ls)\$\(\s*(['"])((?:(?!\1).)*#luckysheet-[\w-][^)]*)\1[^)]*\)/g,
                (match, _quote, selector) => {
                    if (isExemptSelector(selector)) return match;
                    return match.replace(/^\$\(/, "ls$(");
                }
            );

            // 3) Also handle backtick template literals: $(\`#luckysheet-xxx\`)
            transformed = transformed.replace(
                /(?<!ls)\$\(\s*(`)((?:(?!\1).)*#luckysheet-[\w-][^`]*)\1\s*\)/g,
                (match, _quote, selector) => {
                    if (isExemptSelector(selector)) return match;
                    return match.replace(/^\$\(/, "ls$(");
                }
            );

            return {
                code: transformed,
                map: null,
            };
        },
    };
}

export default defineConfig({
    plugins: [slimLocalePlugin(), luckysheetInstanceSelectorPlugin()],
    build: {
        outDir: "dist",
        emptyOutDir: false,
        target: "es2015",
        lib: {
            entry: "src/index.esm.js",
            name: "luckysheet",
            formats: ["umd", "es"],
            fileName: (format) =>
                format === "umd" ? "luckysheet.umd.js" : "luckysheet.esm.js",
        },
    },
    esbuild: {
        legalComments: "none",
    },
});
