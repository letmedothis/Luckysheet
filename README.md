<div align="center">

![logo](/docs/.vuepress/public/img/logo_text.png)

</div>

[简体中文](./README-zh.md) | English

# Luckysheet Custom Edition (self-maintained fork)

This repository is a long-term self-maintained fork based on upstream Luckysheet v2.1.13.

Upstream Luckysheet has stopped maintenance and officially redirects users to Univer. **This project does not follow that migration**: we keep full control of the source, build, release and extension pipeline, and continue refactoring on top of Luckysheet's Canvas rendering and formula engine.

## What we changed

Full record (Chinese): **[docs/refactor-record.md](docs/refactor-record.md)**. Highlights:

| Area | Summary |
| --- | --- |
| State layer | 171-field god-object `Store` split into data/view/interaction domains behind a Proxy facade — zero changes for 73 importing files |
| Render layer | 14 scattered canvas `getContext` call sites consolidated into `src/render/canvasRegistry.ts` |
| Custom cell renderers | `registerCellPainter` seam: take over the content layer per `ct.t`, default pipeline keeps background/badges/borders |
| Custom context menu | `registerCellContextMenuItem` seam for the cell right-click menu |
| Multi-instance isolation | Per-instance Store, instance-scoped DOM IDs, runtime jQuery patch, `createWithRuntime()` entry — multiple spreadsheets on one page without ID collisions |
| TypeScript pilot | `src/store` and `src/render` under `strict` + `noEmit`; `npm run typecheck` |
| Vite build channel | Modern lib build (UMD + ESM) parallel to gulp, ~0.7 s, smaller bundle |
| Locale slimming | `LUCKYSHEET_LANGS` tree-shakes dictionaries (−470 KB); runtime `registerLocale` with en fallback |
| Upstream defects | Residual 10 s timeout after `destroy()` fixed; remaining items timeboxed and documented |

Behavioral baseline with per-scenario browser evidence: [docs/p1-01-baseline-result.md](docs/p1-01-baseline-result.md).

## Development

```bash
npm install --legacy-peer-deps
npm run dev              # gulp dev server (browser-sync)
npm run build            # production build → dist/ (original gulp channel)
npm run build:vite       # modern channel → dist-vite/ (UMD + ESM)
npm run build:vite:slim  # en/zh locales only → dist-vite-slim/
npm run typecheck
```

Always integrate against **this repository's build output** — the published `luckysheet` npm/CDN package is the unmaintained upstream build.

```html
<link rel='stylesheet' href='./dist/css/luckysheet.css' />
<script src="./dist/luckysheet.umd.js"></script>
<div id="luckysheet"></div>
<script>
  luckysheet.create({ container: 'luckysheet' })
</script>
```

### Multi-instance mode

The legacy `luckysheet.create({ container, ... })` still works for a single instance. For multiple spreadsheets on one page, use `createWithRuntime` so each instance gets its own Store and DOM ID namespace:

```js
const rt = luckysheet.SpreadsheetRuntime.create({ container: document.getElementById('sheet-a') });
luckysheet.createWithRuntime({ container: 'sheet-a', data: [...] }, rt);

const rt2 = luckysheet.SpreadsheetRuntime.create({ container: document.getElementById('sheet-b') });
luckysheet.createWithRuntime({ container: 'sheet-b', data: [...] }, rt2);
```

Runtime cleanup:

```js
rt.destroy(); // removes DOM, events, and Store for that instance
```

> Implementation: build-time Vite plugin rewrites `$("#luckysheet-...")` to `ls$(...)`, and a runtime jQuery patch handles remaining selectors. Store switching is via `useInstanceStore()` (`src/store/index.ts`).

### Extension APIs

```js
luckysheet.registerCellPainter("progressBar", (ctx, { cell, x, y, width, height }) => { /* ... */ });
luckysheet.registerCellContextMenuItem({ name: "Mark done", onClick: ({ r, c }) => { /* ... */ } });
luckysheet.registerLocale("ko", { /* ... */ });
```

## Docs map

| Doc | Content |
| --- | --- |
| [docs/refactor-record.md](docs/refactor-record.md) | Full refactor record: changes, extension APIs, verification, leftovers |
| [docs/p1-01-baseline-result.md](docs/p1-01-baseline-result.md) | Browser behavioral baseline and regression evidence |
| [docs/embeddable-spreadsheet-sdk-plan.md](docs/embeddable-spreadsheet-sdk-plan.md) | Embeddable spreadsheet SDK roadmap |
| [docs/ledger-platform-design.md](docs/ledger-platform-design.md) | Ledger platform design |
| [docs/guide/](docs/guide/README.md) | Upstream feature/API reference (local vuepress site) |

## License

[MIT](http://opensource.org/licenses/MIT)

Based on upstream [mengshukeji/Luckysheet](https://github.com/mengshukeji/Luckysheet) — Copyright (c) 2020-present, mengshukeji (MIT).
