<div align="center">

![logo](/docs/.vuepress/public/img/logo_text.png)

</div>

简体中文 | [English](./README.md)

# Luckysheet 定制版（自维护 Fork）

本仓库基于上游 Luckysheet v2.1.13 建立，是我们长期自维护的定制版本。

上游已停止维护并官方导流到 Univer，**本项目不跟随该迁移**：我们选择掌握源码、构建、发布与扩展能力，在 Luckysheet 的 Canvas 渲染与公式引擎基础上持续重构演进。路线与约束见 [docs/embeddable-spreadsheet-sdk-plan.md](docs/embeddable-spreadsheet-sdk-plan.md) 与 [docs/ledger-platform-design.md](docs/ledger-platform-design.md)。

## 项目定位

- 纯前端、类 Excel 的在线表格：Canvas 2D 手绘网格 + 内置公式引擎 + jQuery DOM 层；
- 面向嵌入式集成（SDK 化）与台账类业务定制，而非通用 SaaS 表格；
- 支持单实例与多实例隔离运行。

## 修改记录

完整重构归档见 **[docs/refactor-record.md](docs/refactor-record.md)**，已落地内容包括：

| 项 | 摘要 |
| --- | --- |
| 状态层拆分 | 171 行上帝对象 Store 按 data/view/interaction 三域拆分，Proxy 门面保持 73 个消费文件零改动 |
| 渲染层收口 | 14 处分散的 canvas getContext 收敛到 `src/render/canvasRegistry.ts`（连接自愈缓存） |
| 自定义单元格渲染 | `registerCellPainter` seam：按 `ct.t` 接管内容层绘制，背景/角标/边框仍走默认管线 |
| 自定义右键菜单 | `registerCellContextMenuItem` seam：单元格右键菜单注入扩展项 |
| 多实例隔离 | per-instance Store、实例级 DOM ID、运行时 jQuery 补丁、`createWithRuntime` 双入口 — 同页多表格无 ID 冲突 |
| TypeScript 试点 | `src/store`、`src/render` 严格模式类型化，`npm run typecheck` |
| Vite 构建通道 | 与 gulp 并存的现代通道；UMD 更小、构建 ~0.7s；`build:vite` / `build:vite:slim` |
| locale 减重 | 按 `LUCKYSHEET_LANGS` 裁剪语言包（−470KB）+ 运行时 `registerLocale` |
| 上游缺陷处置 | destroy 后 10 秒 timeout 残留已修复；其余挂账见 refactor-record §5 |

行为基线与逐场景回归证据见 [docs/p1-01-baseline-result.md](docs/p1-01-baseline-result.md)。

## 本地开发与构建

### 环境

[Node.js](https://nodejs.org/en/)（上游按 12.x 验证；本仓库在 Node 24 下 gulp 构建可用，vite 通道需 Node 18+）。依赖安装请使用 `npm install --legacy-peer-deps`。

### 常用命令

```bash
npm run dev              # gulp 开发服务（browser-sync）
npm run build            # 生产构建 → dist/（原 gulp 通道）
npm run build:vite       # 现代构建通道 → dist-vite/（UMD + ESM）
npm run build:vite:slim  # 仅打包 en/zh 语言包 → dist-vite-slim/
npm run typecheck        # store/render 严格类型检查
```

`dist/`、`dist-vite*/` 为构建产物，均已 gitignore。

### 集成方式

与上游 CDN 用法一致，但**一律使用本仓库构建产物**，不要引用 `cdn.jsdelivr.net/npm/luckysheet`（那是上游已停更的官方包）：

```html
<link rel='stylesheet' href='./dist/plugins/css/pluginsCss.css' />
<link rel='stylesheet' href='./dist/plugins/plugins.css' />
<link rel='stylesheet' href='./dist/css/luckysheet.css' />
<link rel='stylesheet' href='./dist/assets/iconfont/iconfont.css' />
<script src="./dist/plugins/js/plugin.js"></script>
<script src="./dist/luckysheet.umd.js"></script>

<div id="luckysheet" style="position:absolute;width:100%;height:100%;left:0;top:0;"></div>
<script>
  luckysheet.create({ container: 'luckysheet' })
</script>
```

### 多实例模式

legacy `luckysheet.create()` 仍支持单实例。如需同页多个表格，使用 `createWithRuntime`，每个实例拥有独立的 Store 和 DOM ID 命名空间：

```js
const rtA = luckysheet.SpreadsheetRuntime.create({ container: document.getElementById('sheet-a') });
luckysheet.createWithRuntime({ container: 'sheet-a', data: [...] }, rtA);

const rtB = luckysheet.SpreadsheetRuntime.create({ container: document.getElementById('sheet-b') });
luckysheet.createWithRuntime({ container: 'sheet-b', data: [...] }, rtB);
```

销毁实例：

```js
rtA.destroy(); // 移除 DOM、解绑事件、清空实例 Store
```

> 实现原理：构建时 Vite 插件将 `$("#luckysheet-...")` 重写为 `ls$(...)`，运行时 `patchGlobalJQuery()` 处理剩余选择器；Store 切换通过 `useInstanceStore()` 完成（见 `src/store/index.ts`）。

### 定制扩展 API

```js
// 自定义单元格渲染类型（数据里 ct.t 用同名类型即命中）
luckysheet.registerCellPainter("progressBar", (ctx, { cell, x, y, width, height }) => { /* ... */ });

// 单元格右键菜单扩展项
luckysheet.registerCellContextMenuItem({ name: "标记为完成", onClick: ({ r, c }) => { /* ... */ } });

// 运行时注册语言包（配合 slim 构建通道使用）
luckysheet.registerLocale("ko", { /* ... */ });
```

## 文档地图

| 文档 | 内容 |
| --- | --- |
| [docs/refactor-record.md](docs/refactor-record.md) | 本轮重构完整记录：改动清单、扩展 API、验证结论、遗留事项 |
| [docs/p1-01-baseline-result.md](docs/p1-01-baseline-result.md) | 浏览器行为基线与回归证据（含 §17 复验补充） |
| [docs/embeddable-spreadsheet-sdk-plan.md](docs/embeddable-spreadsheet-sdk-plan.md) | 可嵌入表格 SDK 演进路线 |
| [docs/ledger-platform-design.md](docs/ledger-platform-design.md) | 台账平台设计 |
| [docs/phase-1-mvp-tasks.md](docs/phase-1-mvp-tasks.md) | Phase 1 任务拆解与验收 |
| [docs/p1-02-sdk-contract-result.md](docs/p1-02-sdk-contract-result.md) / [p1-03](docs/p1-03-ledger-domain-result.md) | SDK 契约 / Ledger 域结果记录 |
| [docs/guide/](docs/guide/README.md) | 上游功能与 API 参考文档（本地 vuepress 站点） |

## 版权信息

[MIT](http://opensource.org/licenses/MIT)

本项目基于上游 [mengshukeji/Luckysheet](https://github.com/mengshukeji/Luckysheet)（Copyright (c) 2020-present, mengshukeji，MIT 许可）修改分发；上游文档与 API 参考保留原文以说明基础能力边界。
