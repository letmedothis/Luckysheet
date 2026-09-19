# P1-01 Luckysheet Engine Baseline Result

> 记录日期：2026-09-13
>
> 任务边界：仅建立 fixture、测试入口和事实基线；未修复 Luckysheet Engine，未开始 P1-02。
> 最终复跑结果：两次连续运行的状态与关键数值一致。

## 1. 测试环境

| 项目 | 实际环境 |
| --- | --- |
| 仓库 | Luckysheet `2.1.13`，当前工作区源码 |
| 操作系统 | WSL/Linux 测试服务器 + Windows 本机浏览器 |
| Node.js | `v24.21.0` |
| npm | `12.0.2` |
| 浏览器 | Microsoft Edge Headless `153.0.0.0`，Chromium `153.0.0.0` |
| 视口 | `1406 × 803`，devicePixelRatio `1` |
| 页面 | `http://localhost:41731/tests/p1-01/baseline.html` |
| E2E 依赖 | 无；未安装 Playwright、Puppeteer、jsdom 或其他测试框架 |

执行入口：

```bash
node tests/p1-01/run-baseline.mjs
```

执行器仅使用 Node 内置 HTTP server 和本机 Edge。页面在 Luckysheet 加载前监控 `fetch`、XHR、WebSocket、动态资源、document/window/body listener、timeout、interval 和 DOM mutation。

本机 `npm run build` 和非压缩的 `npx gulp build` 均在 Node 24 下停留于现有 `core` 构建阶段，生成 `dist/luckysheet.umd.js` 后仍不退出，最终人工中止，退出码为 `130`。未修改构建配置。baseline 页面因此直接加载仓库内的本地 plugin/CSS 源文件和已生成的当前源码 bundle。该构建兼容性问题不属于 P1-01 的 Engine 修复范围，后续应在项目规定的 Node 版本下复核；上游 CI 文件使用 Node `12.13.0`。

## 2. Fixture

Fixture 位于 `tests/p1-01/department-expense.fixture.js`，每次调用 `createWorkbook()` 都返回深复制，避免前一次运行被 Luckysheet 原地修改后污染下一次运行。

### 费用明细

| 单元格 | 值 |
| --- | --- |
| A1 | 日期 |
| B1 | 类别 |
| C1 | 金额 |
| A2 | 2026-09-01 |
| B2 | 交通费 |
| C2 | 100 |
| A3 | 2026-09-02 |
| B3 | 餐费 |
| C3 | 200 |
| C4 | `=SUM(C2:C3)`，fixture 缓存值 300 |

### 汇总

| 单元格 | 值 |
| --- | --- |
| A1 | 总费用 |
| B1 | `='费用明细'!C4`，fixture 缓存值 300 |

两个 Sheet 使用固定 index：`p1-expense-details`、`p1-expense-summary`。每个公式都带有当前 Luckysheet 所需的 `calcChain` 条目。配置显式使用 `loadUrl: ""`、`updateUrl: ""`、`plugins: []`、`userInfo: false`；fixture、脚本、样式和字体全部由本地 server 提供。

## 3. 结果总表

| 能力 | 状态 | 实际结果 |
| --- | --- | --- |
| create | **PASS** | 创建 DOM 成功，无同步异常；`workbookCreateAfter` 未触发 |
| 普通单元格编辑 | **PASS** | 通过当前公开 `setCellValue` 将 C2 从 100 改为 150 |
| 浏览器键盘/IME 编辑路径 | **NOT COVERED** | 最小无依赖 harness 未注入受信任键盘或 IME 事件 |
| 基础公式 | **PASS** | 费用明细 C4 初始值 300，编辑后值 350 |
| 跨 Sheet 公式 | **KNOWN FAILURE** | 首次激活汇总 Sheet 时 B1 从 fixture 缓存值变为 `#NAME?`；随后编辑明细 C2 后变为 350 |
| undo | **KNOWN FAILURE** | C2 恢复 100，C4 恢复 300，但汇总 B1 仍为 350 |
| redo | **PASS** | C2、C4、汇总 B1 均回到 150、350、350 |
| bold | **PASS** | `setCellFormat(1, 1, "bl", 1)` 后 B2 的 `bl` 为 1 |
| workbook/snapshot 获取 | **PASS** | `toJson()` 返回两个 Sheet；当前编辑、公式和粗体数据可见 |
| destroy | **KNOWN FAILURE** | 容器和 body overlay 清理成功，但 listener 和一个 10 秒 timeout 残留 |
| demo/CDN/外网请求 | **PASS** | 捕获到的远程请求为 0 |

`PASS` 表示本次明确断言的当前行为通过。`KNOWN FAILURE` 表示已复现且不在 P1-01 修复。`NOT COVERED` 表示测试入口没有提供足以形成可靠证据的自动化方式。

## 4. Create

**状态：PASS。** `luckysheet.create()` 同步返回后，`#luckysheet-grid-window-1` 在 3 秒期限内出现，未捕获 console error、window error 或 unhandled rejection。

源码事实：

- `src/core.js:47-48` 在每次 create 开始时先调用内部 `method.destroy()`。
- `src/core.js:64-81` 把 container、data 和网络配置写入全局 Store/server。
- `src/core.js:144-149` 根据配置登记并初始化 plugin。本 fixture 的 `plugins` 是空数组。
- `src/core.js:164-167` 在 `loadUrl === ""` 时直接用本地数据初始化，不执行加载请求。

配置的 `workbookCreateAfter` 没有被调用。调用链是 `src/core.js:145` 对空 plugin 数组执行空 `push`，而 `src/controllers/listener.js:39-42` 只在 `Store.asyncLoad.length` 被 Proxy 观察到变为 0 时触发 hook。空数组路径没有产生该变更通知。create 的 DOM 结果仍成功，因此本表把 create 标为 PASS，并把 hook 缺口作为 P1-08 事实保留。

## 5. 普通单元格编辑

**状态：PASS（公开 API 路径）。** 执行 `setCellValue(1, 2, 150, { order: 0 })` 后：

- 费用明细 C2：150；
- 费用明细 C4：350；
- 已经激活加载过的汇总 B1：350。

`src/global/api.js:115-145` 解析目标 Sheet 并复制/构建 data，`src/global/api.js:228-234` 处理普通值或公式，`src/global/api.js:250-254` 对活动 Sheet 走 `jfrefreshgrid` 并进入 history。

真实用户键盘输入、双击编辑和 IME 路径为 **NOT COVERED**。本任务没有引入浏览器自动化框架，也没有用不可信 DOM event 假装用户编辑成功。P1-15 端到端验收应覆盖真实输入路径。

## 6. 基础公式

**状态：PASS。** 费用明细 C4 的 `=SUM(C2:C3)`：

- 初始化后为 300；
- C2 改为 150 后为 350；
- undo 后为 300；
- redo 后为 350。

这说明固定 fixture 的单 Sheet 基础公式、依赖更新及本 Sheet history 重算可以作为后续 SDK baseline。

## 7. 跨 Sheet 公式

**状态：KNOWN FAILURE。** 非活动 Sheet 的 `data` 在初始化时没有构建，`getCellValue` 直接读取 `Store.luckysheetfile[order].data[row][column]`（`src/global/api.js:56-66`），所以测试必须先调用 `setSheetActive(1)`。该调用进入 `sheetmanage.changeSheet`（`src/global/api.js:5203-5225`）。首次激活后，汇总 B1 的 `='费用明细'!C4` 实际值是 `#NAME?`，没有保留缓存值 300。

随后切回费用明细并把 C2 改为 150，汇总 B1 被更新为 350。这表明跨 Sheet 依赖并非完全不可用，失败集中在首次加载/强制计算顺序或命名 Sheet 解析状态。P1-01 不修改公式引擎。P1-05 加载桥和 P1-06 snapshot codec 必须保留此 fixture，不能只用单 Sheet 或只检查缓存值。

## 8. Undo

**状态：KNOWN FAILURE。** 调用现有 `luckysheet.undo()` 后：

- C2：150 → 100，正确；
- C4：350 → 300，正确；
- 汇总 B1：仍为 350，预期 300。

公开 API 的命名和内部栈方向相反：`undo()` 调用 `controlHistory.redo()`（`src/global/api.js:5860-5876`），而 `redo()` 调用 `controlHistory.undo()`（`src/global/api.js:5885-5901`）。内部 `controlHistory.redo` 对 `datachange` 先维护公式链再 `jfrefreshgrid`（`src/controllers/controlHistory.js:62-95`），但本次没有使跨 Sheet 从属值回退。

P1-10 不能只断言被编辑单元格；必须同时断言本 Sheet公式和跨 Sheet 公式。是否由 command bridge 补偿重算，或必须形成受控 Engine 修复，需要在 P1-10 基于该证据决定。

## 9. Redo

**状态：PASS。** 调用现有 `luckysheet.redo()` 后，C2、C4、汇总 B1 分别为 150、350、350。内部路径进入 `controlHistory.undo`，其 `datachange` 分支调用 `formula.execFunctionGroup()` 后刷新数据（`src/controllers/controlHistory.js:447-476`）。

该 PASS 不抵消 undo 的跨 Sheet 缺陷；P1-10 应把两个方向作为独立验收项。

## 10. Bold

**状态：PASS。** 对费用明细 B2 调用当前 `setCellFormat(1, 1, "bl", 1, { order: 0 })` 后，从 `getAllSheets()` 读取的 cell `bl === 1`。

现有路径在 `src/global/api.js:366-432` 复制 data、写入 cell 属性并刷新活动 Sheet。本任务只记录 Engine 能力，没有把它包装成 P1-02 command，也没有修改 toolbar。

## 11. Workbook / Snapshot 数据现状

**状态：PASS（可获取性）。** `toJson()` 返回：

- 两个 Sheet；
- 两个 Sheet 都有 20 行 × 8 列的 dense `data`；
- 同时生成 sparse `celldata`，数量分别为 10 和 2；
- 两个 Sheet 都有 1 个 `calcChain` 条目；
- 顶层包含 `container`、`data`、`forceCalculation`、`hook`、`lang`、`loadUrl`、`plugins`、`showinfobar`、`title`、`updateUrl`、`userInfo`。

源码事实：

- `getAllSheets()` 深复制全局 workbook，并在已有 dense `data` 时重新生成 `celldata`，随后删除 `load` 和 `freezen`（`src/global/api.js:5908-5920`）。
- `toJson()` 直接复用并修改 `Store.toJsonOptions`，从 `#luckysheet_info_detail_input` DOM 读取 title，再写入 `getAllSheets()` 结果和 row/column（`src/global/api.js:6719-6739`）。
- 返回对象混合了初始化配置和运行数据；`hook` 中的函数在 JSON 序列化时会消失。它不是稳定、版本化、与 DOM 无关的正式 snapshot contract。

因此 P1-06 需要定义最小 codec、深复制/规范化规则和明确的可序列化字段，而不能把 `toJson()` 原样直接视为长期持久化格式。本任务未执行 snapshot round-trip；该项由 P1-06 验收。

## 12. Destroy 行为

**状态：KNOWN FAILURE。** 分项证据如下：

| 检查项 | 350 ms 后 | 10 秒后 |
| --- | --- | --- |
| container 子节点 | 0 | 0 |
| body 下 Engine overlay root | 0 | 0 |
| 新增 listener | 仍存在 | 仍存在 |
| timeout | 1 个，10 秒 | 0，已自行执行 |
| interval | 0 | 0 |
| destroy 后异步 DOM mutation | 0 | 0 |
| `window.luckysheet` | 仍存在 | 仍存在 |

创建前已有测试自身和 plugin 的基础 listener。destroy 后相对创建前仍新增：`window.resize`，以及 document/body 上的 `click`、`mouseout`、`mouseover`、`blur`、`wheel`、`keydown`、`change` 等 listener。带 `.luckysheetEvent` 和 `.luckysheetProtection` namespace 的 jQuery handler 已被移除，但一批无该 namespace 的 handler 保留。

残留 timeout 来源是 `setSheetActive()` 无条件调用 `server.multipleRangeShow()`（`src/global/api.js:5224`）；该函数在 `src/controllers/server.js:1022-1028` 创建 10 秒 username timeout。destroy 后 callback 仍执行并自行清除，没有产生 DOM mutation。

`method.destroy()` 当前只清空 container、删除若干已知 body 节点、解绑两个 document namespace 并重置若干全局对象（`src/global/method.js:431-492`）。它没有统一登记/释放 window、document、body listener 和 timer。全局 `window.luckysheet` 是 bundle 导出的库对象，destroy 不卸载脚本，因此仍存在。

P1-05 的 destroy 验收至少应把容器清理与 runtime 资源释放分开报告，并为 listener/timer 建立可重复的所有权与清理策略。本任务不修复残留。

## 13. Network 行为

**状态：PASS。** 两次最终运行都没有捕获到非当前本地 origin 的 XHR、fetch、WebSocket、动态 script/link/image 或 Performance resource。没有访问：

- demo server；
- 旧 websocket；
- unpkg；
- CDN；
- 默认 export server；
- 其他远程 URL。

这是 fixture 配置成立时的结果，不代表默认 demo 安全。源码仍有明确的远程入口：

- 默认配置的 `loadUrl`、`loadSheetUrl`、`updateUrl` 为空且 `allowUpdate` 为 false（`src/config.js:27-32`）；
- demo 页面在特定模式配置 `/luckysheet/api/*` 和 websocket，并默认登记 chart/export/print plugin（`src/index.html:66-97`）；
- chart plugin 会加载 unpkg 上的 Vue、Vuex、Element UI 和 ECharts（`src/expendPlugins/chart/plugin.js:24-44`）。

P1-05 必须显式传递本 baseline 的安全配置，不能依赖 demo options，也不能把未知 plugin 透传。

## 14. 发现的源码事实

1. `create()` 本身先执行一次全局 destroy，并把配置写入单例 Store/server；单实例假设真实存在。
2. 空 plugin 列表时 `workbookCreateAfter` 没有触发，不能作为无条件 ready 信号。
3. 非活动 Sheet 可能只有 `celldata`、没有 dense `data`；`getCellValue(order)` 不负责构建它。
4. 基础公式可用，但带中文 Sheet 名的跨 Sheet 公式在首次激活强制计算时出现 `#NAME?`，后续依赖更新又能得到正确值。
5. undo/redo 的公开名称对应内部反向命名的 history 方法，且 undo 未更新已加载的跨 Sheet 从属公式。
6. `toJson()` 依赖 DOM title、复用可变初始化 options，并同时输出 dense `data` 与 sparse `celldata`。
7. destroy 能清空容器及本次产生的 body overlay，但未完整释放 listener 和 timer；10 秒 callback 会在 destroy 后继续运行。
8. 使用空网络 URL、`allowUpdate: false`、空 plugin 时没有外网请求；demo 与 chart plugin 仍包含网络入口。
9. 当前 Node 24 与旧 gulp/esbuild 构建链存在不退出问题，本轮没有修构建系统。

## 15. 对后续 Phase 1 任务的影响

### P1-02 Spreadsheet SDK facade contract

- `create()` 需要自己的 ready 语义，不能直接承诺 `workbookCreateAfter` 总会触发。
- query 不应暴露“非活动 Sheet 必须先激活才能读取”的内部限制；contract 应明确 load/ready 与错误语义。
- `undo`、`redo` 的公开 command 名必须按用户语义定义，bridge 内部再适配反向的 history 方法名。
- capability 只能声明经过本 fixture 验证的能力；键盘/IME 路径仍应标为未验收。

### P1-05 Single-instance create/destroy bridge

- 必须强制 `loadUrl/updateUrl/loadSheetUrl` 为空、`allowUpdate` 为 false、plugin allowlist 为空。
- ready 不能只依赖现有空 plugin hook。
- destroy 要分别处理容器、body overlay、listener、timer 和延迟 callback，并接受现有全局单例事实。
- 跨 Sheet 加载顺序必须由 bridge 显式处理和测试。

### P1-06 Snapshot codec

- 不能把 Luckysheet JSON 定义成 Ledger，也不能直接持久化可变的 `Store.toJsonOptions`。
- codec 需要规范化 dense `data`、sparse `celldata`、`calcChain`、row/column 和稳定 Sheet index。
- 应删除函数、DOM 派生 title、container、hook、网络 URL 等 runtime/config 字段。
- round-trip 必须覆盖双 Sheet、中文 Sheet 名、公式、bold 和非活动 Sheet 数据。

### P1-08 Edit/change event

- 空 plugin 时 `workbookCreateAfter` 缺失，不能用它作为事件订阅初始化的唯一门槛。
- `cellUpdated` 由零延迟 timeout 触发（`src/global/api.js:237-248`），事件时序不是完全同步。
- change event 需要区分直接 cell 变化、公式派生变化和 history 变化；本次 undo 的跨 Sheet stale 值证明只上报源 cell 不够。

### P1-10 Undo / Redo / Bold

- undo、redo、bold 的最小能力都有可调用入口。
- undo 当前存在跨 Sheet 派生公式不回退的 KNOWN FAILURE；P1-10 必须用本 fixture 固化期望，并明确是受控补偿还是 Engine 修复。
- bold 使用 cell 属性 `bl: 1`，但正式 command 仍需由 P1-02 contract 定义，不能让 toolbar 直接调用本 API。

## 16. 本任务没有实施的内容

没有新增 Spreadsheet facade、Ledger Domain、Product Shell、产品 toolbar、后端、数据库或 UI framework；没有修改 Store、controller、Luckysheet Engine、构建配置、package 或现有生产源码；没有处理品牌、公式缺陷、history 缺陷或 destroy 残留。

## 17. 重构阶段复验补充（Phase 2/3 之后）

基线在 Store 拆分、canvas 收口、Vite 通道、locale 减重与右键菜单 seam 落地后重跑，仍为 7 PASS / 3 KNOWN FAILURE / 1 NOT COVERED，与本文记录一致。其中 destroy 场景有一项实质变化：

- **10 秒残留 timeout 已修复。** 根因即 §12 记录的 `setSheetActive()` 末尾无条件空调用 `server.multipleRangeShow()`（`src/global/api.js:5224`，协同编辑调试残留）。该调用已删除；复验后 destroy 后 `activeTimeouts=0`、`activeIntervals=0`、容器外 body 节点为 0。
- **listener 残留维持 KNOWN FAILURE，不修复。** 残留为 `window.resize`（`src/controllers/handler.js:271`）与 document/body 上 `click/mouseout/mouseover/blur/wheel/keydown/change` 各 1 个无 namespace 的 handler。上游绑定分散在 tooltip、对话框初始化等多个生命周期不同的模块，统一加 namespace 或 destroy 时全量 `off()` 会波及宿主页面/插件的 handler，风险大于收益；维持 §12 结论，归入 P1-05 的 listener/timer 所有权设计处理。
- 跨 Sheet 公式首次激活 `#NAME?` 与 undo 不回退跨 Sheet 派生公式：本轮复核未复现出可安全最小修复的路径（前者偶发、依赖强制重算时序；后者是 history 只记录源 cell 的结构性缺口），继续按 KNOWN FAILURE 挂账，分别归 P1-06/P1-08 与 P1-10 范围。

