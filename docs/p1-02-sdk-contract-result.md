# P1-02 Spreadsheet SDK Facade Contract Result

> 完成日期：2026-09-14
>
> 范围：公开 contract、FakeSpreadsheetInstance、可复用 contract suite。
> 未实施：Luckysheet Legacy Bridge、真实 codec、旧事件聚合、真实 history/format 适配及任何 Ledger/Product 功能。

## 1. 交付结论

P1-02 在独立的 `packages/sdk` 下建立了框架无关的 JavaScript + JSDoc contract。模块可在无 DOM 的 Node 环境安全 import，且不 import Store、controller、`src/global/api`，不读取 `window.luckysheet` 或 Luckysheet DOM。

生产名称 `createSpreadsheet(container, options)` 已固定签名，但 P1-02 没有真实 runtime。当前调用会明确抛出 `CREATE_FAILED`，并把实现责任标记为 P1-05。它不会偷偷创建 Fake，也不会假装 Spreadsheet 已加载成功。

Product Shell 独立开发使用明确的测试入口：

```js
import { createFakeSpreadsheet } from "../packages/sdk/index.mjs";

const spreadsheet = await createFakeSpreadsheet(container, {
  readonly: false,
  snapshot,
});
```

P1-05 接入真实 Legacy Bridge 时替换 `createSpreadsheet` 的实现，不改变实例 API。P1-11 可以显式依赖 `createFakeSpreadsheet`，集成时再替换 creator。

## 2. 最终公开 API

```js
const instance = await createSpreadsheet(container, {
  readonly: false,
  snapshot,
});

instance.destroy();
await instance.load(snapshot);
const copy = instance.getSnapshot();

await instance.setCellValue(
  { sheetId: "details", row: 1, column: 2 },
  { value: 150 }
);

await instance.execute({
  type: "sheet.set-format",
  sheetId: "details",
  ranges: [
    { startRow: 1, endRow: 1, startColumn: 2, endColumn: 2 },
  ],
  patch: { bold: true },
});

await instance.undo();
await instance.redo();
const selection = instance.getSelection();
const capabilities = instance.getCapabilities();
const unsubscribe = instance.on("workbook-change", listener);
instance.resize();
unsubscribe();
```

所有行列从 0 开始，range 结束位置包含在范围中。宿主始终使用稳定 `sheetId`；active Sheet、Luckysheet order 和 DOM index 不属于公开参数。

本轮没有加入 `setOptions`、插件、范围权限、文件、结构操作或完整格式 API。`sheet.set-format` 在 Fake 中仅实现显式 `bold: boolean`，其他 patch 返回 `UNSUPPORTED_COMMAND`。

## 3. 生命周期 Contract

实例状态只有：

```text
creating → ready → destroyed
```

- `createSpreadsheet()`/`createFakeSpreadsheet()` 返回 Promise；Promise 成功时实例已经是 `ready`。
- create 失败时 Promise 拒绝，不返回半初始化实例。Fake 的初始化失败统一为 `CREATE_FAILED`，原始稳定错误放在 `cause` 和 `details.causeCode`。
- `ready` 的定义是“公开 contract 可以调用”，不规定由 `workbookCreateAfter` 触发。
- `destroy()` 同步、幂等，只产生一次 `destroy` 事件。
- destroyed 后除重复 `destroy()` 外，所有实例方法稳定抛出或拒绝 `INSTANCE_DESTROYED`。
- `NOT_READY` 已进入错误 contract，供 P1-05 创建中/加载中保护使用；公开 create 成功前不会泄漏 creating 实例。
- `resize()` 是同步入口。Fake 只验证生命周期并执行 no-op，不声称具有渲染能力。

## 4. Snapshot Contract

```js
{
  schemaVersion: 1,
  dataFormat: "luckysheet",
  workbook: {
    sheets: []
  },
  extensions: {}
}
```

约束如下：

- `schemaVersion` 当前只接受整数 `1`；其他整数返回 `UNSUPPORTED_SNAPSHOT_VERSION`。
- `dataFormat` 当前只接受 `luckysheet`。这是兼容格式标记，不是 Ledger 模型。
- `workbook` 必须是对象，`workbook.sheets` 必须是数组。
- `extensions` 必须是对象。
- Sheet 必须有非空 `sheetId` 或 legacy `index`，转换为字符串后必须唯一。Fake 和 contract 只使用该稳定 ID，不使用数组 order。
- 整个 Snapshot 只能包含有限数值和普通 JSON 对象/数组/标量；函数、`undefined`、循环引用、DOM/类实例会返回 `INVALID_SNAPSHOT`。
- `load()` 先完整校验和复制，再替换当前数据；失败不改变旧 workbook。readonly 实例允许 `load()`，因为它是宿主加载文档，不是用户修改命令。
- `getSnapshot()` 每次返回新的 JSON 副本。调用方修改 Snapshot、Sheet、cell 或 extensions 都不会影响 Fake runtime。

本轮只定义 envelope、JSON 安全性和基本 Sheet 身份规则。dense `data` 与 sparse `celldata` 的优先级、稳定 ID 映射元数据、公式缓存、未知字段保留和 round-trip 由 P1-06 实现。

## 5. Command Contract

Phase 1 的最小命令为：

| Command | 参数 | P1-02 Fake |
| --- | --- | --- |
| `sheet.set-cell-value` | `target + value/formula` | 支持 |
| `sheet.set-format` | `sheetId + ranges + patch.bold` | 仅支持 bold |
| `workbook.undo` | 无 | 支持 |
| `workbook.redo` | 无 | 支持 |

命令使用单一对象 `execute(command)`。未知 type 或 Fake 未实现的格式 patch 返回 `UNSUPPORTED_COMMAND`，不会返回虚假成功。

成功的 document command 返回：

```js
{
  commandId: "fake-command-1",
  revision: 1,
  affectedRanges: [
    {
      sheetId: "details",
      range: {
        startRow: 1,
        endRow: 1,
        startColumn: 2,
        endColumn: 2
      }
    }
  ]
}
```

Fake 的 revision 只是实例内单调递增的操作版本，不是 LedgerRevision，也不参与服务端 CAS。

## 6. `setCellValue` 与公式输入

`setCellValue(target, input)` 是 `sheet.set-cell-value` 的便捷入口，内部直接调用 `execute()`，没有第二套更新逻辑。

```js
// 文本，即使以 = 开头也不变成公式
await instance.setCellValue(target, { value: "=ABC" });

// 公式必须显式表达
await instance.setCellValue(target, { formula: "=SUM(C2:C3)" });
```

`value` 只接受 JSON scalar：string、有限 number、boolean 或 null。`formula` 必须是以 `=` 开始的非空字符串。二者同时出现或同时缺失均返回 `INVALID_ARGUMENT`。

Fake 只保存公式 DTO，不计算公式，也没有声明 production-ready 的键盘/IME 编辑能力。公式计算仍由未来 Legacy Bridge 使用 Engine 提供。

## 7. Capability Contract

每项能力都返回：

```js
{
  supported: true,
  enabled: false,
  reasonCode: "NO_UNDO_HISTORY"
}
```

- `supported=false` 表示当前 SDK implementation 没有该能力。
- `supported=true, enabled=false` 表示能力存在，但受 readonly、history 或当前状态限制。
- Phase 1 Fake 只列出它实际实现的四项：`sheet.set-cell-value`、`sheet.set-format.bold`、`workbook.undo`、`workbook.redo`。
- 没有进入 Phase 1 capability catalog 的能力不会被 Fake 声称为 supported。
- readonly 时四项 mutation capability 都是 `enabled=false`、`reasonCode=READONLY`。
- 无 undo/redo history 时对应 reason 分别是 `NO_UNDO_HISTORY`、`NO_REDO_HISTORY`。
- capability DTO 每次返回副本；Toolbar 不需要读取旧按钮 class。

## 8. Selection DTO

```js
{
  sheetId: "details",
  ranges: [
    {
      startRow: 0,
      endRow: 0,
      startColumn: 0,
      endColumn: 0
    }
  ]
}
```

Selection 不含 Luckysheet selection、Store range、DOM 或内部引用。`getSelection()` 返回副本。Fake 默认选择第一个 Sheet 的 A1；`load()` 后按新 workbook 第一个 Sheet 重置选择并发出 `selection-change`。P1-07 才实现真实 selection/history query adapter。

## 9. Event Contract

公开事件名限定为：

| Event | 最小 payload |
| --- | --- |
| `ready` | `{type, state: "ready"}` |
| `selection-change` | `{type, selection}` |
| `history-change` | `{type, canUndo, canRedo}` |
| `capabilities-change` | `{type, capabilities}` |
| `workbook-change` | `{type, source, commandType, revision, affectedRanges}` |
| `destroy` | `{type, state: "destroyed"}` |

`on(event, listener)` 返回幂等 unsubscribe。事件 payload 是冻结的 JSON 副本，不含 Store、controller、DOM 或可变 runtime 对象。一个 listener 抛错不会回滚已经提交的命令，也不会阻止其他 listener；Fake 只隔离此错误，正式错误上报策略留给实际 runtime/宿主集成。

Fake 的 `ready` 采用可重放语义：create Promise 成功后订阅仍会在 microtask 收到一次 ready，使 Product Shell 无需依赖 Engine 内部 hook 时序。

P1-02 没有连接任何 Luckysheet listener。真实 edit/change 聚合、IME 提交点、load 是否置 dirty 和 destroy 后迟到事件由 P1-08 实现。

## 10. Error Contract

`SpreadsheetSdkError` 至少包含 `code` 和 `message`，可选 `details`、`cause`；业务层无需解析 Luckysheet 原始错误文本。

| Code | 含义 |
| --- | --- |
| `INSTANCE_DESTROYED` | 已销毁实例仍被调用 |
| `INVALID_ARGUMENT` | target、range、cell input、event 等参数非法 |
| `INVALID_SNAPSHOT` | Snapshot 结构或 JSON 数据非法 |
| `UNSUPPORTED_SNAPSHOT_VERSION` | Snapshot schemaVersion 未支持 |
| `UNSUPPORTED_COMMAND` | 命令或命令子能力未实现 |
| `COMMAND_DISABLED` | 能力存在但当前没有 history 等执行条件 |
| `READONLY` | readonly 实例收到 workbook mutation |
| `NOT_READY` | 实例尚未达到公开 ready 状态 |
| `CREATE_FAILED` | 创建阶段失败或真实 runtime 尚未安装 |

`isSpreadsheetSdkError(error, code?)` 用于稳定识别错误。错误对象提供 JSON 表示，但不会序列化底层 `cause`。

## 11. FakeSpreadsheetInstance 支持范围

Fake 支持：

- Promise create 与 ready 状态；
- 幂等 destroy 和 destroyed 门禁；
- Snapshot 校验、深复制、原子 load；
- stable sheetId 定位，不依赖 Sheet 数组顺序；
- 显式文本/公式的 set-cell-value；
- 单/多 range 的 bold true/false；
- 实例内 snapshot history 的 undo/redo；
- selection/capability 查询副本；
- 六类确定性事件及幂等 unsubscribe；
- readonly API 门禁；
- unknown command 明确失败；
- 生命周期安全的 no-op resize。

Fake 不支持渲染、公式计算、键盘/IME、真实 selection 变化、Luckysheet codec、复杂格式、Range ACL、多实例 Engine 隔离或持久化。它不会为这些能力返回虚假成功。

## 12. Contract Tests

可复用 suite 位于 `tests/p1-02/spreadsheet-contract-suite.mjs`，只接收：

```js
defineSpreadsheetContractSuite({
  implementationName,
  create,
  createHost,
});
```

没有 Fake 私有依赖。P1-05 及后续真实能力完成后，可把 Legacy creator 和浏览器 host 注入同一 suite。

最终共 19 项测试：18 项可复用 contract test，加 1 项 P1-02 生产入口防误用测试。覆盖 create 生命周期及失败、destroy 幂等、destroyed 操作、Snapshot 深复制/校验/原子性、未知版本、未知命令、readonly、setCellValue 映射、显式公式、stable sheetId、bold、undo/redo 用户语义、capability supported/enabled、Selection 隔离、unsubscribe、listener 异常隔离和非法参数。

执行命令：

```bash
node tests/p1-02/fake-spreadsheet-instance.contract.test.mjs
```

最终结果：`19 passed, 0 failed, 0 skipped`。

## 13. Node / Build 环境观察

仓库事实：

- `package.json` 没有 `engines`。
- 根目录没有 `.nvmrc`、`.node-version` 或 `.tool-versions`。
- 根 `package-lock.json` 存在于当前工作区，但被 `.gitignore` 忽略，不是可依赖的版本锁定声明。
- GitHub demo/docs workflow 使用 Node `12.13.0`，代表历史构建环境；该版本已经不足以运行本轮使用的内置 `node:test`。
- 当前机器只安装 Node `24.21.0`。P1-02 `.mjs` import、语法检查和 19 项 contract test 均通过。
- P1-01 已确认旧 gulp/esbuild 在 Node 24 生成 core bundle 后不退出；P1-02 没有升级 gulp、esbuild 或依赖树，也没有再次把构建修复混入本任务。

当前证据只能得出：SDK contract 的纯 Node 测试可在 Node 24 运行，现有完整生产构建仍未在该版本通过。建议后续单独确定一个受支持的 Node LTS，并建立“SDK contract test + 旧生产 build”版本矩阵后，再新增 `engines`/`.nvmrc` 声明。本轮不修改 Node 版本声明。

## 14. P1-01 事实如何影响 Contract

1. **全局单实例**：contract 不承诺多实例，P1-02 Fake 可多实例但不代表 Engine；真实限制必须由 P1-05 在进入旧 create 前检查。
2. **create 先 destroy**：production creator 当前不触碰 Engine；P1-05 必须先占用再调用旧 create，防止误删已有实例。
3. **`workbookCreateAfter` 不可靠**：ready 只定义公开状态，不绑定任何旧 hook。
4. **非活动 Sheet 无 dense data**：公开地址只用 stable sheetId，不暴露“先激活再读取”的要求。
5. **跨 Sheet 首次 `#NAME?`**：未写入 contract 成功语义，也未在 Fake 假装计算已正确。
6. **undo 跨 Sheet stale**：contract 只定义 undo=撤销、redo=重做；真实一致性由 P1-10 验证。
7. **`toJson()` 不稳定**：定义了独立版本化 Snapshot 和深复制/JSON 安全要求。
8. **destroy 有资源残留**：contract 要求幂等销毁和 destroyed 门禁；真实释放由 P1-05 完成。
9. **键盘/IME 未验收**：没有声明完整编辑已 production-ready。

## 15. 留给后续任务的明确责任

### P1-05 Legacy Bridge

- 为 `createSpreadsheet` 安装真实 creator，同时保持本轮签名和错误类型。
- 在调用旧 create 前完成单实例/容器占用判断。
- 自己判定 Engine ready，不能只等待 `workbookCreateAfter`。
- 建立 stable sheetId → Luckysheet order/index 映射；宿主不能先激活 Sheet。
- 保证创建失败不返回半实例，destroy 幂等并清理 listener、timer、overlay 和迟到 callback。
- 把所有旧异常转换成稳定 SDK error，禁止原始错误文本泄漏。

P1-05 最大风险是旧 `create()` 入口第一步就全局 destroy。如果占用检查、创建取消或 ready 判定发生在旧 create 之后，第二个/失败的实例会破坏当前有效实例，并可能让残留 callback 写回新页面。

### P1-06 Snapshot Codec

- 定义正式 LegacyWorksheet 字段范围及标准输出形态。
- 解决 dense `data`/sparse `celldata`、calcChain、公式缓存和未知字段。
- 持久化 stable sheetId 与 legacy index 的映射，处理数字/字符串冲突、重排和重命名。
- 从 `toJson()` 中剥离 container、DOM title、hook、函数和网络配置。
- 用 P1-01 双 Sheet fixture 完成 load → snapshot → load round-trip。

### P1-08 Event Aggregation

- 连接真实 selection/history/capability/workbook change 源。
- 聚合一次用户提交为一次事件，处理公式派生变化、load、undo/redo 和 bold。
- 明确 IME 确认/取消、dirty 时序和 destroy 后迟到事件。
- 不把旧 hook 的内部刷新次数直接暴露为业务事件次数。

### P1-10 History / Format

- 把 `workbook.undo`、`workbook.redo` 映射到正确的旧行为，隐藏内部反向方法名。
- 解决或明确隔离 P1-01 的跨 Sheet undo stale 限制。
- 将 `sheet.set-format` 的 `bold: boolean` 映射到旧 `bl`，并让真实 capability 与 history 状态一致。
- 不把 Fake 的 snapshot history 或公式空实现带入 Legacy 实现。

## 16. 本任务边界核对

本轮没有修改 Luckysheet Core、Store、controller、DOM、Toolbar、Product Shell、Ledger Domain、Legacy Bridge、Snapshot codec、生产事件接缝、构建脚本、package、依赖或 Node 版本声明。P1-03、P1-05 及其他 Phase 1 任务均未开始。
