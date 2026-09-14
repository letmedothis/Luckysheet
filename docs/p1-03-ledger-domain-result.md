# P1-03 Minimal Ledger Domain Result

> 完成日期：2026-09-14
>
> 范围：Phase 1 最小 Ledger Domain、固定 DefinitionVersion fixture、纯创建用例和 Node 测试。
> 未实施：Repository、数据库、HTTP、CAS、Product Shell、Spreadsheet Legacy Bridge 及其他 Phase 1 任务。

## 1. 交付结论

P1-03 在 `packages/ledger-domain` 中建立了纯 JavaScript + JSDoc 领域模块。依赖方向为：

```text
Ledger Domain
     │
     └── Spreadsheet SDK Snapshot validator
```

Ledger Domain 不 import Luckysheet、Store、controller、FakeSpreadsheetInstance、Legacy Bridge 或 DOM。它可在纯 Node 环境运行。

本轮明确保持以下关系：

```text
LedgerDefinitionVersion
          │ templateSnapshot 深复制
          ▼
    LedgerRevision 1 ──────► SpreadsheetSnapshot
          │
          └── LedgerInstance.headRevision = 1
```

`SpreadsheetSnapshot` 是不可变 Ledger Revision 保存的文档内容，不是 Ledger 聚合本身。`department`、`period`、业务状态和权限不会写入 Spreadsheet cell 作为领域事实。

## 2. 最终领域对象

### 2.1 LedgerDefinitionVersion

| 字段 | 类型 | Phase 1 含义 |
| --- | --- | --- |
| `id` | string | 稳定 DefinitionVersion ID |
| `code` | string | 稳定定义代码 |
| `name` | string | 定义显示名称 |
| `version` | positive integer | 定义版本，从 1 开始 |
| `templateSnapshot` | SpreadsheetSnapshot | 创建 Ledger Revision 1 的模板 |

### 2.2 LedgerInstance

| 字段 | 类型 | Phase 1 含义 |
| --- | --- | --- |
| `id` | string | 稳定 Ledger ID |
| `definitionVersionId` | string | 创建时固定的 DefinitionVersion ID |
| `name` | string | 台账实例名称 |
| `department` | optional string | 部门稳定 code/ID，只是实例元数据 |
| `period` | optional string | 月份，格式 `YYYY-MM` |
| `status` | `draft` | Phase 1 唯一状态 |
| `headRevision` | positive integer | 当前已持久化 Ledger Revision 号 |
| `createdAt` | ISO-8601 string | 创建时间 |
| `updatedAt` | ISO-8601 string | 最近更新时间 |

### 2.3 LedgerRevision

| 字段 | 类型 | Phase 1 含义 |
| --- | --- | --- |
| `id` | string | 稳定 Revision ID |
| `ledgerId` | string | 所属 Ledger ID |
| `revision` | positive integer | 持久化版本号，从 1 开始 |
| `snapshot` | SpreadsheetSnapshot | 本 Revision 的完整表格文档 |
| `createdBy` | string | 创建该 Revision 的 actor ID |
| `createdAt` | ISO-8601 string | Revision 创建时间 |

`createLedgerDraft` 输出的 LedgerRevision 及其 Snapshot 会深度冻结。P1-13 写入后续版本时必须追加新对象，不能覆盖或修改旧 Revision。

### 2.4 LedgerCapabilities

```js
{
  canView: true,
  canEdit: true,
  canSave: true
}
```

三个字段必须都是 boolean。`createLedgerCapabilities()` 返回隔离、冻结的 DTO。

它表示业务授权结果，与 Spreadsheet SDK 的 `{supported, enabled, reasonCode}` Engine capability 不同。P1-03 不提供角色、策略合并或权限查询框架。

## 3. DefinitionVersion 规则

- `id`、`code`、`name` 必须为非空字符串。
- `version` 必须为大于等于 1 的整数。
- `templateSnapshot` 必须通过 P1-02 `validateSpreadsheetSnapshot()`。
- 单个 DTO 只允许五个已定义字段；Field、Range、Record、Workflow 等属性会被拒绝。
- `validateLedgerDefinitionVersionSet()` 拒绝重复 `id`，也拒绝同一个 `code + version`。
- 固定 fixture 深度冻结，Phase 1 不提供编辑、发布、继承和版本迁移。

LedgerInstance 只记录创建时的 `definitionVersionId`。未来出现新版本时，已有实例不会自动漂移。

## 4. LedgerInstance 规则

- `id`、`definitionVersionId`、`name` 必须为非空字符串。
- `department` 可省略；存在时必须为非空字符串。P1-03 不连接组织架构系统。
- `period` 可省略；存在时必须使用 `YYYY-MM`，月份限定为 `01` 至 `12`。
- `status` 只能为 `draft`。
- `headRevision` 必须为大于等于 1 的整数。
- `createdAt`、`updatedAt` 必须为可解析的 ISO-8601 timestamp。
- DTO 不接受未声明字段，不包含 Record、BindingMap、policy 或 Spreadsheet command 状态。

## 5. LedgerRevision 规则

- `id`、`ledgerId`、`createdBy` 必须为非空字符串。
- `revision` 必须为大于等于 1 的整数。
- `snapshot` 复用 P1-02 Snapshot validator。
- `createdAt` 必须为可解析的 ISO-8601 timestamp。
- `validateLedgerRevision(revision, {ledgerId})` 可验证 Revision 是否属于预期 Ledger。
- Domain 创建的 Revision 深度冻结；后续保存必须创建 Revision N+1。

P1-03 不决定 Revision ID 生成策略，也不分配后续 Revision number。这些值由 P1-13 的持久化事务产生或协调。

## 6. LedgerCapabilities

公开函数：

```js
const capabilities = createLedgerCapabilities({
  canView: true,
  canEdit: true,
  canSave: false,
});
```

P1-11 可用它控制业务页面的查看、编辑和保存状态。Workspace 后续应将 `canEdit` 与 Spreadsheet capability/readonly 组合，但不能把 LedgerCapabilities 直接解释为 Engine 已支持某个 command。

没有加入 `canCreate`：创建权限属于创建用例边界，当前 instance DTO 和固定 fixture 没有使用者需要它。

## 7. createLedgerDraft 用例

```js
const { instance, revision } = createLedgerDraft({
  definitionVersion: DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1,
  ledgerId: "ledger-expense-finance-2026-09",
  revisionId: "ledger-expense-finance-2026-09-r1",
  name: "财务部 2026-09 月度费用台账",
  department: "finance",
  period: "2026-09",
  createdBy: "user-001",
  now: "2026-09-14T08:00:00.000Z",
});
```

确定性结果：

- `instance.status === "draft"`；
- `instance.definitionVersionId === definitionVersion.id`；
- `instance.headRevision === 1`；
- `revision.revision === 1`；
- `revision.ledgerId === instance.id`；
- `revision.snapshot` 是 `templateSnapshot` 的深复制；
- 输出 instance、revision 和 snapshot 均不可变。

`now`、`ledgerId` 和 `revisionId` 由调用方显式传入，使领域函数不读取系统时钟、不生成随机 ID，也不访问数据库。

## 8. Snapshot 如何复用 P1-02 Contract

Ledger Domain 直接 import：

```js
import {
  cloneSpreadsheetSnapshot,
  validateSpreadsheetSnapshot,
} from "../sdk/snapshot.mjs";
```

没有复制第二套 Snapshot schema 或 validator。未知 schemaVersion 继续返回 P1-02 的 `UNSUPPORTED_SNAPSHOT_VERSION`，非法格式继续返回 `INVALID_SNAPSHOT`。

P1-03 只验证 envelope、JSON 安全性和稳定 Sheet ID。dense `data`、sparse `celldata`、公式缓存和正式 round-trip 仍属于 P1-06。

## 9. Spreadsheet Command Revision 与 LedgerRevision

两种 revision 没有数据关系：

| 名称 | 作用域 | 生命周期 | 持久化用途 |
| --- | --- | --- | --- |
| Spreadsheet command result `revision` | SpreadsheetInstance 内部操作序号 | 当前运行实例 | 不参与 Ledger 保存或 CAS |
| `LedgerRevision.revision` | Ledger 持久化版本 | 跨打开和保存 | 更新 `headRevision`、执行 CAS |

`createLedgerDraft` 不接受 `commandRevision`，未知输入字段会报 `INVALID_CREATE_LEDGER_DRAFT_ARGUMENT`。它总是把初始 `headRevision` 和 Ledger revision 设置为 1。

## 10. 固定 Fixture

正式 fixture 为 `DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1`：

- ID：`department-monthly-expense-v1`；
- code：`department-monthly-expense`；
- name：`部门月度费用台账`；
- version：1；
- Sheet `department-expense-details` / `费用明细`；
- Sheet `department-expense-summary` / `汇总`；
- 明细包含日期、类别、金额及 `=SUM(C2:C3)`；
- 汇总包含 `='费用明细'!C4`；
- 所有 Sheet 同时有稳定 `sheetId` 和 legacy `index`，不以数组 order 表示公开身份；
- 完全本地，不包含插件、URL、网络配置或 DOM 数据。

它复用了 P1-01 的业务含义和已验证的最小 Luckysheet 数据形态，但代码位于生产 Domain 目录，不 import `tests/p1-01`。

## 11. 测试

纯 Node 测试位于 `tests/p1-03/ledger-domain.test.mjs`。执行：

```bash
node tests/p1-03/ledger-domain.test.mjs
```

共 19 项，结果为 `19 passed, 0 failed, 0 skipped`。覆盖：

- 合法、非法及重复 DefinitionVersion；
- P1-02 Snapshot validator 和稳定错误码复用；
- 固定双 Sheet、基础公式和跨 Sheet 公式 fixture；
- 创建 draft、Revision 1 和 headRevision 1；
- Snapshot 深复制、DefinitionVersion 固定引用和 Revision 不可变；
- draft-only 状态、department/period 可选性及月份校验；
- 非法 headRevision、Revision number、Snapshot 和 ledgerId ownership；
- LedgerCapabilities 隔离、不可变和字段校验；
- Spreadsheet command revision 无法进入 Ledger Domain。

测试不启动浏览器、Luckysheet、数据库或网络。

## 12. P1-11 可以依赖什么

P1-11 Product Shell 可以依赖：

- `DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1` 展示固定产品场景；
- `createLedgerDraft()` 建立 Mock Repository 使用的初始 instance/revision；
- `LedgerInstance` 的 name、department、period、status、headRevision 和时间字段；
- `LedgerRevision.snapshot` 作为传给 Fake Spreadsheet 的文档；
- `createLedgerCapabilities()` 生成 `canView/canEdit/canSave` 业务能力 DTO；
- 各 validator 在 Mock 边界拒绝非法数据。

P1-11 仍需把 Ledger capability 与 Spreadsheet capability 分开处理，Save 仍是 Ledger Application action，不能变成 Spreadsheet command。

## 13. P1-13 可以依赖什么及仍需实现什么

P1-13 可以复用所有 DTO、validator、固定 fixture 和 `createLedgerDraft()` 的初始聚合结果。它仍需在后端选择明确后实现：

- DefinitionVersion seed 的读取；
- 在单个数据库事务中插入 LedgerInstance 与不可变 Revision 1；
- 按 Ledger ID 读取 instance 和 head Revision；
- 按 `(ledgerId, revision)` 读取指定旧 Revision；
- 数据库内联 Snapshot 的序列化、大小限制和 schema 校验；
- 在同一事务中比较 `baseRevision`、追加 Revision N+1 并更新 headRevision；
- `(ledgerId, revision)` 唯一约束；
- 冲突时不写数据并返回 `REVISION_CONFLICT`/HTTP 409；
- 授权端口及 `canView/canEdit/canSave` 的服务端计算；
- 事务失败回滚和 Repository contract tests。

P1-03 没有选择数据库或后端框架，也没有定义 HTTP DTO。

## 14. 明确延期内容

以下内容没有进入 P1-03：Repository、Database、migration、HTTP API、CAS、Object Storage、Workflow、Attachment、Audit、Revision 列表/diff/restore、Record、FieldDefinition、RangeDefinition、BindingMap、Projection、Definition Editor、定义发布/继承/迁移、组织架构、Role/Policy、Range/Field ACL、真实权限查询、Product Shell、Toolbar、Legacy Bridge 和 Snapshot codec。

本轮没有修改 Luckysheet Core、现有生产源码、构建配置、package 或依赖。P1-04、P1-05、P1-11、P1-13 及其他 Phase 1 任务均未开始。
