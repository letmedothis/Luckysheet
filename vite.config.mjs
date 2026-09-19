import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

// 现代构建通道（阶段 3）：与 gulp/esbuild 通道并存
// CSS、静态资源仍由 gulp 的 css/plugins/copyStatic* 任务负责
//
// 语言裁剪：LUCKYSHEET_LANGS=en,zh npm run build:vite
//   仅打包指定语言，未引用的语言包被 tree-shake；产物输出到 dist-vite-slim/
//   运行时可用 luckysheet.registerLocale('es', dict) 补充其他语言

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

export default defineConfig({
    plugins: [slimLocalePlugin()],
    build: {
        outDir: langs.length > 0 ? "dist-vite-slim" : "dist-vite",
        emptyOutDir: true,
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
