# 重构记录：阶段 1–3（架构拆分 · 扩展 seam · 现代构建）

本文归档本轮重构（一次连续会话）落地的全部修改：改动清单、验证证据、扩展 API 用法与遗留事项。逐场景行为基线见 `p1-01-baseline-result.md`（含 §17 复验补充）。

约束回顾：渐进式改造，不重写既有代码；每步改动后用浏览器回归基线验证（`node tests/p1-01/run-baseline.mjs`）。

## 1. 状态层拆分（Store 三层 + Proxy 门面）

原 `src/store/index.js` 是 171 行、94 个字段的上帝对象，73 个文件直接 import。拆分后：

- `src/store/data.store.ts` / `view.store.ts` / `interaction.store.ts` — 94 个字段按域原样迁移；
- `src/store/index.ts` — 默认导出 Proxy 门面，按字段归属转发 get/set/has/ownKeys/defineProperty/deleteProperty；未声明的字符串键（如 `toJsonOptions` 动态写入）落到 interaction 域；兼容 `hasOwnProperty` 特判与 `Object.prototype` 回退（`utils/util.js` 的 `createProxy`/`defineObjectReactive` 响应式监听依赖这两点）；
- 消费方零改动，`import Store from '../store'` 语义不变。

回归教训：初版门面缺 `hasOwnProperty`/`defineProperty` 转发导致 create 崩溃（`e.hasOwnProperty is not a function`），已修复并固化进基线。

## 2. 渲染层收口

- `src/render/canvasRegistry.ts` — 主/测量 canvas 注册表，`getGridContext2d()`/`getContext2d(id)` 以 `isConnected` 自愈缓存，DOM 重建无需手动失效；收口 8 个文件共 14 处散落的 `$("#luckysheetTableContent").get(0).getContext("2d")`（draw.js、handler.js、refresh.js、getRowlen.js、formula.js、rowColumnOperation.js、sheetmanage.js、sparkline.js）。
- `src/render/cellPainters.ts` — 自定义单元格渲染器注册表。命中 `cell.ct.t` 时 painter 接管"内容层"绘制，背景、角标、合并、边框仍走默认管线；内置类型 `n/s/d/b/p` 需 `{ allowOverride: true }` 才可覆盖。接入点唯一：`draw.js` cellRender 内容分支头部 `tryPaintCell(...)`。

## 3. 扩展 API（对外出口均在 `luckysheet` 对象 / `src/global/api.js` 再导出）

```js
// 自定义单元格渲染类型
luckysheet.registerCellPainter("progressBar", (ctx, { cell, x, y, width, height }) => { ... });
luckysheet.unregisterCellPainter("progressBar");

// 单元格数据：ct.t 用同名类型即可命中 painter，例如
// { v: 0.6, ct: { t: "progressBar", tp: 0.6 } }

// 右键菜单（单元格分支）扩展项
const id = luckysheet.registerCellContextMenuItem({
  name: "标记为完成", order: 10, hidden: false,
  onClick: ({ r, c, sheetIndex }) => { ... }
});
luckysheet.unregisterCellContextMenuItem(id);

// 运行时注册语言包（配合减重通道使用）
luckysheet.registerLocale("ko", { ... }); // Store.lang 未注册时回退 en 并告警一次
```

## 4. TypeScript 试点 + Vite 构建通道（与 gulp 并存）

- `tsconfig.json` — `strict` + `noEmit`，include 仅 `src/store`、`src/render`；`npm run typecheck`（注意用 `./node_modules/.bin/tsc`，`npx tsc` 会装错包）。
- `src/index.esm.js` — vite 库入口（纯 default 导出，UMD 全局 `window.luckysheet` 不带 `.default` 嵌套）。
- `vite.config.mjs` — lib 模式 UMD+ES，target es2015；`slimLocalePlugin`：设 `LUCKYSHEET_LANGS=en,zh` 时把 `src/locale/locale.js` 的 `./active` 重定向到仅含所选词典的生成文件，rollup 摇掉其余语言包。
- `src/locale/active.js` + 重写 `locale.js` — 词典聚合拆出，运行时 `registerLocale`，locales 仍暴露给 core。

脚本：

```bash
npm run build            # 原 gulp 通道（未破坏）
npm run build:vite       # 现代通道 → dist-vite/（~0.7s，UMD 比 gulp 小 ~0.35MB）
npm run build:vite:slim  # 仅 en/zh → dist-vite-slim/（再小 ~470KB，gzip 543KB vs 630KB）
npm run typecheck
```

## 5. 上游已知缺陷处置（时间盒）

| 缺陷 | 处置 |
| --- | --- |
| destroy 后 10 秒 timeout 残留 | **已修复**：删除 `setSheetActive()` 末尾无参调试调用 `server.multipleRangeShow()`（原 `api.js:5224`）。复验 destroy 后 timeouts=0、intervals=0、容器外节点=0 |
| destroy 后 listener 残留（window.resize、document/body 若干无 namespace handler） | 不修复：上游绑定分散、全量 off 会误伤宿主页面/插件，归 `phase-1-mvp-tasks.md` P1-05 的资源所有权设计 |
| 跨 Sheet 中文表名公式首激活偶发 `#NAME?` | 挂账：偶发、依赖强制重算时序，无安全最小修复；归 P1-06/P1-08 |
| undo 不回退跨 Sheet 派生公式 | 挂账：history 只记源 cell 的结构性缺口；归 P1-10 |

## 6. 验证结论

每阶段合并后均跑完整验证，最终一次全绿：

- `tsc --noEmit` 通过；esbuild 打包语法自检通过；
- gulp 生产构建 exit 0（`dist/luckysheet.umd.js` 3.18MB）；
- 浏览器基线：**7 PASS / 3 KNOWN FAILURE / 1 NOT COVERED**，与阶段 1 记录的基线一致，且 destroy 场景证据改善（见上表）；
- vite 全量/slim 通道构建正常。

## 7. 本轮文件清单

新增：`src/store/{index,data.store,view.store,interaction.store,types}.ts`、`src/render/{canvasRegistry,cellPainters}.ts`、`src/controllers/contextMenuExt.js`、`src/locale/active.js`、`src/index.esm.js`、`vite.config.mjs`、`tsconfig.json`。

修改：`src/store/index.js`（删除，由门面替代）、`src/global/{draw,api,refresh,formula}.js`、`src/controllers/{handler,sheetmanage,rowColumnOperation,sparkline}.js`、`src/global/api.js` 末尾再导出扩展 API、`src/locale/locale.js`、`src/core.js`、`src/utils/util.js`、`package.json`（devDeps +typescript/vite，+4 个 script）。
