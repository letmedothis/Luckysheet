# 台账平台产品化架构与 UI 设计

## 1. 当前状态分析与设计约束

本方案承接 [embeddable-spreadsheet-sdk-plan.md](./embeddable-spreadsheet-sdk-plan.md)，将其作为底层 SDK 演进路线；不迁移到 Univer，不重写整套表格、不全面改名/迁移 TypeScript/移除 jQuery/更换构建工具。本阶段交付设计，未实现本文件中的服务、组件或接口。

复核日期：2026-09-13；源码基线：`e7b76a8` 及本轮开始时的工作区。三份同名草稿在本轮开始前已存在，本轮在保留既有设计方向的基础上复核和补充；原 SDK 方案的未提交内容保持原样。完整扫描范围、证据及静态审计限制见 UI 审计 §1、§8。

产品定位是**以 Spreadsheet 为核心交互界面的业务台账平台**。Luckysheet 成为 SDK 内部实现，最终用户使用台账，业务开发者使用我们自己的契约，只有引擎维护者接触上游实现。

源码证据和 A–E 分类见 [UI 审计](./luckysheet-ui-audit.md)。关键事实：当前引擎仍是单例；原 UI 配置不能完整隔离全局菜单和弹层；公式输入、菜单状态与数据修改耦合；主构建是 IIFE；打印缺少实现、插件表只接入图表；本地工作表保护不是业务鉴权；仓库没有 Ledger/Workflow 服务端领域实现。旧 API 能力存在不代表已满足新 SDK 的事务、异步、权限或多实例契约。

本文标记 **现状** 的内容有源码证据；**设计** 是后续实现约定；**NEED VERIFY** 是需要实测、产品选择或外部系统资料确认的事项。源码静态扫描不替代浏览器回归和第三方资产许可核验。UI 审计末节列出对已有 SDK 文档应追加的契约，不改变其 M0–M6 顺序及验收门禁。

设计默认值：PC 优先、一个台账实例对应一个工作簿、先支持单据式固定区域及受控明细表、单个活动审批流程、非实时协同。业务示例采用“部门月度费用台账”：部门和月份是元数据，费用明细有稳定 Record 身份，金额可用于统计与审批。产品名称、首个框架、实际工作流引擎和规模上限留在第 20 节，不阻塞框架无关契约设计。

## 2. 产品总体架构

```text
Application Shell：身份、导航、路由、通知、产品帮助
  └─ Ledger Workspace：台账标题、编辑会话、保存、业务校验、面板编排
       ├─ Ledger Domain / Application Service
       │    ├─ 定义与实例、Record/Field 绑定、权限、Revision、附件、审计
       │    ├─ Persistence Port → Ledger Backend → DB / Object Storage
       │    └─ Workflow Port → Backend Workflow Adapter → Workflow Engine
       ├─ 自有 Spreadsheet Toolbar / SDK UI Extensions
       └─ 公开 Spreadsheet SDK
            └─ Spreadsheet Runtime → Luckysheet Legacy Bridge / 逐步实例化实现
```

业务数据写入由 Ledger Service 决策；表内编辑和渲染由 SDK 执行；工作流任务由 Workflow Service/Adapter 执行。三个模块通过 DTO、命令和事件沟通，不共享 Store、DOM 或数据库表的可变对象。

| 层                    | 拥有                                                               | 不拥有                                             |
| --------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| Application Shell     | 登录态、导航、全局产品主题、通知中心、帮助                         | 单元格公式、引擎内部节点                           |
| Ledger Application    | 台账编辑会话、标题、状态、保存/提交、附件与面板编排                | 公式解析、内部 controller、流程引擎协议            |
| Ledger Domain/Backend | 定义版本、业务校验、权限决策、结构化索引、修订与审计               | 前端选区、DOM、引擎全局对象                        |
| Spreadsheet SDK       | 工作簿模型、计算、选择、编辑、格式、命令/历史、表内 UI、快照编解码 | 用户角色数据库、台账状态机、审批操作和业务文件权限 |
| Workflow Integration  | 标准任务/状态/历史、引擎适配、回调归一化                           | 修改单元格、计算范围权限、直接访问 Workbook        |

先在同一仓库按逻辑模块开发，不以微服务或大量 npm 包作为前提。推荐未来目录为 `apps/ledger-web`、`modules/ledger-domain`、`modules/ledger-application`、`modules/design-system`、`modules/workflow-contract`、`server/ledger`、`server/workflow-adapters`；这些是拟建路径，当前不存在。SDK 仍按原方案在现有源码内先建立边界，再决定物理拆包。

## 3. UI Architecture：页面与模式

### 3.1 页面体系与区域职责

至少包含：台账列表、台账工作区、定义/模板列表及版本编辑、我的待办、授权历史版本查看。定义发布和权限配置是管理页；不把所有管理入口堆进 Spreadsheet Toolbar。

```text
┌──────────────── Application Header：产品、部门切换、用户 ────────────────┐
│ Navigation │ Ledger Header：名称 / 业务状态 / 保存状态 / 版本             │
│ 台账       │ 保存 · 提交/发起流程 · 附件 · 历史 · 更多 · 专注模式           │
│ 待办       ├───────────────────────────────────────┬───────────────────┤
│ 定义       │ 自有 Spreadsheet Toolbar              │ Inspector Tabs    │
│            │ SDK 公式栏 / 名称框（可配置）           │ 流程 / 附件 / 历史 │
│            ├───────────────────────────────────────┤                   │
│            │ Spreadsheet Area                      │ 当前一个活动面板  │
│            │ 网格 / 表内编辑 / 选区 / SDK 弹层       │ 审批操作固定底部  │
│            ├───────────────────────────────────────┤                   │
│            │ SDK Sheet Bar / 选区统计 / 缩放         │                   │
└────────────┴───────────────────────────────────────┴───────────────────┘
```

推荐起始布局：Header 56px；Navigation 208px、收起 56px；Ledger Header 72–96px；Toolbar 40px 可折入更多菜单；Inspector 360px，可调 320–480px；中心区域 `min-width: 0; min-height: 0`。这些是设计尺寸，不是已实现或实测上限。≥1280px 展示侧栏，1024–1279px 优先收起导航并将 Inspector 变抽屉，较窄屏首版提供查看和提示，不承诺完整编辑。

工作区外壳稳定，打开附件/流程/历史只改变可用宽度，通过 SDK `resize()` 更新；不销毁重建表格。历史预览与当前编辑在单实例桥接期采用切换会话或独立页面，先处理未保存内容；M2 完成后才允许双实例并排对比。

### 3.2 独立的状态维度

| 状态维度     | 值/含义                                                | UI 行为                                                         |
| ------------ | ------------------------------------------------------ | --------------------------------------------------------------- |
| 页面加载     | loading / ready / not-found / forbidden / failed       | loading 用宿主骨架；无权限不加载完整 Workbook；失败可重试       |
| 编辑会话     | view / edit / approval / historical                    | 决定呈现方式，不能代替权限判断                                  |
| 持久化       | clean / dirty / saving / failed / offline / conflict   | Ledger Header 独立显示；只有服务器确认才显示“已保存”            |
| 校验         | valid / invalid / pending                              | 显示字段与范围错误，点击通过 SDK 定位；pending/invalid 阻止提交 |
| 台账业务状态 | draft / in-review / returned / completed / archived    | 由 Ledger 状态机维护，不能由单元格颜色推断                      |
| 流程同步     | idle / starting / synced / action-pending / sync-error | 请求超时显示“处理中/待核实”，不误报审批完成                     |
| 权限         | loading / effective / stale / revoked                  | 未得到策略时默认只读；撤权立即关闭写入口并重新授权读取          |

### 3.3 编辑、查看、只读与审批

| 模式     | Spreadsheet                                    | Ledger Header                                    | 侧面板                                        |
| -------- | ---------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| 编辑     | 仅允许策略授权的范围/操作；显示编辑工具        | 保存，校验通过后提交；失败/冲突可见              | 附件、字段校验、历史                          |
| 查看     | 不发写命令；可选择、按权限复制/搜索/缩放       | 有 EDIT 时显示“进入编辑”；无自动保存             | 只读附件和流程摘要                            |
| readonly | 是能力约束，可叠加任何模式；布局隐藏不改变约束 | 隐藏/禁用不允许操作并给原因                      | 按面板权限决定操作                            |
| 审批     | 默认展示绑定的提交修订，禁止直接改被审批内容   | 显示“审批版本”和当前流程状态                     | Workflow Panel 显示自己的任务及批准/驳回/转交 |
| 历史版本 | 固定 Revision，只读，无自动保存                | “历史版本”标识；有权限且处于可恢复状态时提供恢复 | 版本说明和审计，不重放旧流程动作              |

审批中允许局部编辑是后续可选策略：只能编辑定义中明确为非审批输入的区域，形成新的工作修订，流程仍引用原提交修订。凡会改变审批条件的字段必须撤回/退回后重新提交；不能悄悄替换审批依据。审批意见写 Workflow，不写单元格批注。驳回可开放定义指定区域，仍需当前用户 EDIT 权限。

全屏提供两种能力：宿主“专注模式”隐藏 Header/Navigation 并保留薄 Ledger 状态/退出条；浏览器 Fullscreen API 作为可选增强，由宿主拥有的工作区节点发起。SDK overlayContainer 位于该全屏节点内。退出保留选区、草稿和历史；Esc 优先取消表内编辑/关闭弹层，之后退出专注模式；状态和未保存提示始终可访问。

### 3.4 交互与可访问性

Ledger 与 Toolbar 只订阅 SDK 的选择、样式、历史、编辑状态、工作簿变更、计算和错误事件。选区变化更新工具栏混合态；字段错误通过 `revealRange` 定位；附件点击仅对有合法锚点的记录调用选择 API。侧栏开关、主题变化和路由卸载通过公开 SDK 方法处理。

按钮都有可访问名称、禁用原因、焦点样式；粗体等支持 mixed 状态；颜色不单独承担状态含义。下拉菜单键盘导航、焦点返回、IME composition 和快捷键冲突进入测试。首版 Canvas 不宣称完整读屏表格支持；关键业务字段、校验错误及审批摘要提供可访问的结构化列表，不能仅画在 Canvas 上。

### 3.5 工作区之外的产品页面

| 页面/建议路由                             | 页面内容及动作                                                                        | 数据/权限和空错态                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 台账列表 `/ledgers`                       | 部门、期间、定义、状态过滤；名称搜索；名称/部门/期间/状态/更新人/保存时间列；新建入口 | 查询元数据/投影，不创建 SDK；空列表提供授权的新建入口，筛选无结果允许清除筛选；403 与网络失败分开 |
| 新建台账 `/ledgers/new`                   | 选择已发布定义版本、部门、期间、名称；创建后进入工作区                                | 校验 CREATE 权限及定义适用部门；模板预览采用静态摘要或独立会话，单例期不在现有编辑页中再挂 SDK    |
| 模板定义 `/ledger-definitions/:id`        | 草稿版本、字段类型/绑定范围/规则、模板快照预览、校验及发布                            | PUBLISH_DEFINITION；发布影响预览，不自动升级存量实例；错误按 fieldId/rangeId 定位                 |
| 我的待办 `/tasks`                         | 待我处理/我发起/已办；台账名、节点、发起人、时间；打开审批工作区                      | Workflow 标准 DTO；空待办、过期任务、无权任务分别处理；不得在列表直接改工作簿状态                 |
| 历史 `/ledgers/:id/revisions/:revisionId` | 固定版本正文、元数据、附件与变更摘要；恢复动作入口                                    | 当前访问策略重新鉴权；readonly；版本不存在与保留策略移除给明确提示，禁止自动保存                  |

CREATE 是台账操作权限，独立于 EDIT/PUBLISH_DEFINITION。Header 的状态徽标、保存状态和流程同步状态各用独立文本：例如“审批中 · 已保存 · 流程启动待核实”。同页不同时铺开三个侧面板；History Tab 的操作审计和文档修订采用不同列表，Workflow History 保留在流程页签，不把三种时间线混为撤销记录。

## 4. Ledger Domain Model：一个台账是什么

**一个台账实例是依据已发布定义创建、具有业务身份和生命周期的数据集合。** Workbook 是其编辑与呈现载体；部门、权限、附件、流程和审计不依赖工作簿某个单元格是否存在。

```text
LedgerDefinition（定义身份）
  └─ DefinitionVersion（不可变发布版本，含字段/范围/规则/模板引用）
       ├─ TemplateSnapshot（初始布局和公式）
       └─ LedgerInstance（绑定创建时的定义版本）
            ├─ Workbook → Worksheet（SDK 文档对象）
            ├─ Field/Record 绑定及结构化投影
            ├─ Revision → SnapshotRef + BindingRef + AttachmentManifest
            ├─ Attachment / PermissionPolicy / AuditLog
            └─ WorkflowBinding → 0..N 历史流程，最多 1 个活动流程
```

| 概念               | 是否必要及最小职责                                                  | 不应混淆                                        |
| ------------------ | ------------------------------------------------------------------- | ----------------------------------------------- |
| LedgerDefinition   | 必要：台账类型身份、名称、所有者、发布状态                          | 不是每份台账的数据                              |
| DefinitionVersion  | 必要：不可变字段、范围、规则、模板及流程策略版本                    | 已发布版本不可覆盖，实例不自动漂移到最新版      |
| Template           | 必要的资产概念；首版是定义版本引用的快照，不单独建模板交易/继承体系 | 普通 Worksheet 不是模板版本                     |
| LedgerInstance     | 必要的聚合根：ID、定义版本、部门、期间、业务状态、headRevisionId    | Luckysheet JSON 不是整个聚合                    |
| Workbook/Worksheet | 必要，由 SDK 管理；每实例一个 Workbook，可有多个 Worksheet          | 一个 Sheet 不自动是一个独立台账或业务表         |
| FieldDefinition    | 必要：稳定 fieldId、类型、来源、校验、索引与敏感级别                | 中文列标题/坐标不等于字段身份                   |
| RangeDefinition    | 必要但轻量：固定区域/明细表/系统展示区及结构编辑规则                | 不引入通用低代码布局引擎                        |
| Record             | 明细区需要：稳定 recordId、所属 tableRangeId、业务行值              | 非每行皆 Record；标题、合计和空白行不建业务记录 |
| Attachment         | 必要：业务文件、所属实例/记录、版本、授权、扫描状态                 | 单元格图片不是附件系统，上传成功不代表已关联    |
| WorkflowBinding    | 必要的关联记录：逻辑流程定义、实例业务键、提交 Revision、策略版本   | 不在 Workbook 中保存引擎 taskId 作为权威        |
| WorkflowInstance   | 必要的集成读模型：本地 ID、引擎引用、标准状态及同步版本             | 不复制实现整个工作流引擎                        |
| Permission         | 必要：策略/授权和求值结果；不要求每个单元格一条 ACL                 | `config.authority` 不是业务策略数据库           |
| AuditLog           | 必要：谁在何时对哪个对象做了什么、依据哪个版本                      | 不是 undo 栈，也不由客户端自报为可信事实        |
| Revision           | 必要：不可变、已提交的一致性版本及父版本                            | 自动保存序号、UI 撤销步和流程状态不是同一个版本 |
| Snapshot           | 必要：SDK 文档序列化资产，绑定 schema/codec 版本                    | 不装入用户角色、令牌、任务和可执行回调          |

### 4.1 最小领域字段

```ts
interface LedgerInstance {
  id: string;
  tenantId: string;
  definitionVersionId: string;
  workbookId: string;
  name: string;
  departmentId: string;
  period: string; // 例：2026-09，具体粒度由定义确定
  businessStatus: "draft" | "in-review" | "returned" | "completed" | "archived";
  headRevisionId: string;
  ledgerVersion: number; // 元数据/状态并发控制，独立于文档修订
  createdBy: string;
}

interface FieldDefinition {
  id: string;
  code: string; // 同一定义中唯一，接口查询使用稳定 code/id
  label: string;
  type: "text" | "decimal" | "date" | "boolean" | "enum" | "reference";
  scope: "ledger" | "record";
  source: "ledger-metadata" | "workbook-input" | "server-derived";
  bindingId?: string;
  required: boolean;
  indexed: boolean;
  sensitivity: "normal" | "restricted";
}
```

货币使用明确精度的十进制值和币种；日期值区分纯日期、业务月份与带时区时间戳。工作簿显示格式不是业务类型。字段规则采用受限、版本化规则表达，不把模板中的任意 JS 交给服务器执行。

### 4.2 范围/记录身份和结构变更

RangeDefinition 首版仅支持 `fixed-fields`、`record-table`、`system-display`。绑定中保存 `bindingId + sheetId + rangeId/fieldId`，具体坐标放在每个 Revision 的 BindingMap 中；坐标是定位数据，不是业务主键。

明细表以 `recordId` 为身份，排序/插入/删除需要一起更新 BindingMap；不得使用行号或用户可修改的隐藏 ID 单元格作权威。初期只允许完整记录行的受控新增/删除/排序，不能在明细表部分列上排序、跨记录合并、把记录 ID 粘贴覆盖或剪切一半字段。模板编辑与实例填报的结构权限不同。

SDK 在结构命令提交前提供可验证的范围变换计划，Ledger Binding 层参与校验，在同一编辑事务内提交文档变更和绑定变更；服务端再验证两者一致。接口尚未实现时**关闭绑定区结构命令**，不采用“收到 cell-change 后猜坐标并异步补救”的方案。未绑定自由区仍可保留普通 Spreadsheet 编辑，且不能绕过结构影响检查。

### 4.3 可以直接作为契约夹具的最小绑定

以下是领域 DTO 示例，均为设计；Workbook 内容仍使用父方案的 `SpreadsheetSnapshot`，不再定义第二套 Cell 格式。

```json
{
  "definitionVersionId": "expenses-v1",
  "ranges": [
    { "id": "summary", "kind": "fixed-fields", "sheetId": "sheet-main" },
    { "id": "expenses", "kind": "record-table", "sheetId": "sheet-main" }
  ],
  "bindingMap": {
    "schemaVersion": 1,
    "fields": [
      { "fieldId": "department", "rangeId": "summary", "row": 1, "column": 1 }
    ],
    "tables": [
      {
        "rangeId": "expenses",
        "headerRow": 4,
        "columns": { "expenseDate": 0, "category": 1, "amount": 2 },
        "records": [{ "recordId": "record-a", "row": 5 }],
        "totalRow": 6
      }
    ]
  }
}
```

坐标仍为零基，`sheetId` 从 RangeDefinition 解析；部门是服务端元数据的展示绑定，不是可编辑输入。`BindingMap` 的版本和正文放在同一 Manifest 中。首版固定模板可初始化少量空白 Record；存在 recordId 的空白业务行仍保留身份，可处于 incomplete，不从“某单元格非空”推断是否创建/删除 Record。空白布局行没有 recordId。新记录使用 UUID，服务端验证本实例内唯一、来源操作合法、未盗用其他实例身份；复制台账/导入为新实例时重新生成 recordId，保留可审计的来源映射。

附件/字段错误锚点采用 `ledgerId + rangeId + recordId? + fieldId?`；用户选择任意非绑定区域时才使用带修订号的坐标锚点。删除 Record 必须报告附件关联和公式引用影响，不自动删除附件文件。MVP 不建立通用模板继承、多活动流程、每 Cell 一条 ACL 或独立 Record 微服务。

结构事务接缝是 SDK 的通用扩展协议：`prepare(command, beforeRevision) → immutable transformPlan`，参与者只提交可序列化外部状态及校验结果；全部准备成功后才发布正文/绑定/历史/一次事件。SDK 不 import Ledger 类；Ledger Binding 插件也只能用公开事务扩展。准备失败/撤销/重做须同时处理两个状态；禁止先修改 DOM 再等待后端确认。服务端按受支持操作重新计算变换计划，不能只相信客户端提交的新坐标。

## 5. Spreadsheet Boundary：单元格与业务数据

### 5.1 三种持久化方案比较

| 维度                   | A：Workbook 唯一业务源           | B：结构化业务库为源、表格是 UI       | C：完整 Workbook + 关键字段投影                  |
| ---------------------- | -------------------------------- | ------------------------------------ | ------------------------------------------------ |
| 初期复杂度/成本        | 最低，保存整份 JSON              | 最高，需要完整字段到单元格映射与回写 | 中等，需字段绑定、抽取和版本一致性               |
| 业务查询/分页          | 经常逐份解析，索引困难           | 强，原生业务查询                     | 强，元数据及关键字段索引；自由单元格不承诺可检索 |
| 工作流条件             | 易依赖坐标及客户端公式缓存       | 直接使用受校验结构化值               | 使用绑定提交 Revision 的服务端投影               |
| 统计/跨台账报表        | 成本高、口径难固定               | 最佳                                 | 适合关键字段；新统计维度需要定义/回填            |
| 自由布局/公式/复杂格式 | 最易保留                         | 映射复杂，导入后难还原自由结构       | 保留完整文档及可查询业务字段                     |
| 性能                   | 单份好实现，列表与统计扩展弱     | 业务查询强，复杂 Workbook 重建成本高 | 保存需解析，读列表不加载文档，投影可重建         |
| 一致性                 | 一份文档简单，但业务状态仍须独立 | 业务字段明确，UI 与公式结果需同步    | 必须防止 Snapshot 与投影跨版本错配               |
| 后续扩展               | 容易困在 JSON 内查询             | 适合强结构、表单型业务               | 适合逐步从自由表格收敛到受控台账                 |

**推荐 C，且明确权威来源。** 这是对可查询性与现有 Workbook 保真需求的平衡，不意味着维护两套可随意独立修改的业务真值：

- 名称、部门、期间、状态、定义版本、权限和流程归 DB，若显示在表内，则是受保护的系统投影。
- `workbook-input` 字段的权威是已提交 Revision 中绑定单元格的原始输入；结构化索引由服务端从该版本抽取，禁止客户端直接更新索引。
- `server-derived` 字段由版本化业务规则计算。客户端公式结果只用于展示，不能直接作为审批金额或权限判断依据。
- 自由表格内容只保存在 Workbook；只有声明为业务字段的内容进入查询/统计契约。

方案 B 可在个别纯结构化台账中作为未来实现策略，但不是本轮另建一套数据源。不得在一份定义中对同一个字段同时开启任意 DB 修改与任意 Cell 修改。

### 5.2 例子和 SDK 交互

“部门月度费用台账”的 `departmentId/period` 来自 Ledger 元数据；明细的 `expenseDate/category/amount` 绑定 Record 字段，服务端抽取 date/enum/decimal；`totalAmount` 按规则从明细求和。Workbook 中可用公式显示合计，但提交条件使用服务器计算的 totalAmount。用户改字体不会改变业务金额，用户移动业务行必须同时移动 Record 身份。

Ledger 层通过 `getSnapshot/readRange/execute/on` 等公开能力工作；不直接解析 Luckysheet 的 `v/f/m/ct`。旧数据读取和字段抽取的格式适配由 SDK codec 或隔离的 WorkbookCodec 模块负责。后端可读取该 codec 的标准化 cell view，不导入有 DOM 副作用的 `src/index.js`，也不要求把当前引擎强行运行在 Node 中。

标准 `CellView` 至少区分 `input`、`formula`、`cachedResult`、`displayText`、`valueType`，不能把旧 `getCellValue(type='v')` 直接当可靠原值接口：当前 [api.js](../src/global/api.js#L56) 对特定日期格式会返回 `m`，对 inlineStr 会拼接富文本。首版审批关键输入字段不接受自由公式；服务端派生金额通过受限业务规则计算。普通自由区仍允许 Spreadsheet 公式。如果未来需要任意公式参与审批，必须先有经过兼容测试的可信服务端计算能力，不能接受浏览器上报的计算结果。

## 6. Workflow Boundary

### 6.1 适配器职责

真实 WorkflowAdapter 位于后端；浏览器调用 Ledger/Workflow API，不持有引擎密钥。适配器输入只包含业务键、不可变提交版本、经服务器校验的变量和可信操作者上下文，不包含 Runtime、Store、DOM 或可修改 Workbook 的函数。

```ts
interface WorkflowAdapter {
  getCapabilities(): WorkflowCapabilities;
  startWorkflow(input: StartWorkflowInput): Promise<WorkflowReceipt>;
  approve(input: TaskActionInput): Promise<WorkflowReceipt>;
  reject(input: RejectTaskInput): Promise<WorkflowReceipt>;
  withdraw(input: WithdrawInput): Promise<WorkflowReceipt>;
  transfer(input: TransferTaskInput): Promise<WorkflowReceipt>;
  getStatus(ref: WorkflowRef): Promise<WorkflowStatus>;
  getTasks(query: WorkflowTaskQuery): Promise<CursorPage<WorkflowTask>>;
  getHistory(
    query: WorkflowHistoryQuery
  ): Promise<CursorPage<WorkflowHistoryItem>>;
}
```

输入共有 `requestId/idempotencyKey`、业务/任务引用和预期流程版本；执行者从服务端认证和引擎任务归属校验取得，不能信任前端 `userId`。审批/驳回含意见；驳回目标为定义允许的返回点，转交对象由组织目录及任务规则验证。引擎不支持某动作时声明 capability=false 并返回 `WORKFLOW_ACTION_UNSUPPORTED`，不能伪造成功。

### 6.2 命令、事件和最终状态

```ts
interface WorkflowEvent {
  eventId: string;
  schemaVersion: 1;
  type:
    | "workflow.started"
    | "workflow.approved"
    | "workflow.rejected"
    | "workflow.withdrawn"
    | "workflow.transferred"
    | "workflow.completed"
    | "workflow.failed";
  tenantId: string;
  workflowInstanceId: string;
  ledgerId: string;
  submissionRevisionId: string;
  providerVersion?: string;
  occurredAt: string;
  correlationId: string;
}
```

`workflow.approved` 表示一次任务审批，不表示整个流程完成；仅确认的终态事件/状态触发业务完成。适配器归一化引擎状态但不写单元格。Ledger 状态策略消费事件，更新业务状态与 policyVersion；客户端重新取得计算后能力，并通过 SDK 更新权限。

| 业务状态/事件                   | Ledger 策略                          | Spreadsheet 结果                    |
| ------------------------------- | ------------------------------------ | ----------------------------------- |
| draft                           | 按角色、部门、定义授予编辑           | 授权范围可编辑                      |
| started / in-review             | 锁定审批输入；可选非审批区域受控编辑 | 默认只读，局部编辑必须显式授权      |
| rejected / returned             | 恢复策略指定范围，保留旧提交记录     | 指定范围可编辑，非全表自动解锁      |
| withdrawn                       | 恢复 draft；记录撤回及原绑定         | 按新的有效策略重算                  |
| approved（单任务）/ transferred | 更新任务归属，不擅自改业务终态       | 不因单次批准全表解锁或完成          |
| completed                       | 确认终态并锁定业务文档               | readonly；后续更正走新版本/更正流程 |
| failed / sync-error             | 保留已知安全状态，进入人工/自动核实  | 不因网络失败自动解锁                |

### 6.3 提交与引擎的一致性

先 `commitEdit()`、等待业务校验、完成保存，再用服务器确认的 Revision 发起提交。服务端锁定实例并验证 headRevision、ledgerVersion、当前权限、规则、附件扫描和投影版本，在同一 DB 事务建立 submission、WorkflowBinding 与 outbox。提交请求幂等；定义要求审批时，“提交”和“发起流程”是同一业务事务的两个 UI 表述，不能创建两次流程。无需审批的定义可由提交直接完成，仍保留提交 Revision。

Worker 使用稳定业务键调用引擎并落地引擎引用。请求超时进入 starting/sync-error，查询引擎核实后重试；没有引擎幂等或按业务键查询能力时不得盲目重复 start。回调经过验签、防重放、tenant/绑定校验和 inbox 去重，乱序事件按 providerVersion 检查；没有可靠顺序时拉取引擎现态核实。过期历史流程事件不能更改新流程的台账状态。

**锁定必须发生在接收提交的 DB 事务中，不能等 `workflow.started` 回调。** 首版在创建 submission/outbox 时将 Ledger 置为 `in-review`，同步状态置为 `starting`，写入唯一 `activeWorkflowBindingId` 并递增 ledgerVersion/policyVersion；UI 显示“提交处理中”。同实例并发保存、改部门、第二次提交随即因状态或版本冲突拒绝。工作流表对同一 tenant/ledger 只允许一个非终结绑定（包括 starting/sync-error）。只有确认引擎没有创建流程且本地补偿事务成功，才释放该绑定并恢复提交前业务状态；不确定的超时继续锁定并对账。

批准/转交也使用幂等 action 记录和任务版本检查。引擎已执行而本地落库失败时通过对账补齐，不以“最后一次网络响应”判定业务事实。outbox/inbox 可先是同一数据库的表和定时任务，无需先引入消息集群。

### 6.4 引擎替换所需的最小 DTO

`StartWorkflowInput` 包含逻辑流程定义及版本、`businessKey = tenant/ledger/submissionId`、submissionRevisionId、变量 schemaVersion 和类型化变量；`TaskActionInput` 包含本地 workflow/task 引用、expectedVersion、意见及 idempotencyKey。`WorkflowReceipt` 返回 `operationId + accepted|confirmed + providerRef?`；只有 confirmed 及核实后的投影可以显示动作已完成。任务 DTO 至少有 taskId、workflowInstanceId、名称、assignee、candidateScope、version、allowedActions、createdAt；历史 DTO 区分 task-action 与 process-transition，保留操作者、意见和来源 eventId。

能力表明确 `idempotentStart / lookupByBusinessKey / orderedEvents / taskVersionCheck / supportedActions`。adapter 只归一化协议，业务状态策略版本属于 Ledger 定义。更换引擎时新 submission 可使用新 provider；在途实例继续由原 provider 完成或通过另立迁移流程处理，不能把历史 taskId 直接交给新引擎。

## 7. Permission Model

### 7.1 权威、上下文和组合规则

```ts
interface PermissionContext {
  tenantId: string;
  subjectId: string;
  roleIds: string[];
  departmentScope: string[];
  ledgerId: string;
  definitionVersionId: string;
  businessStatus: string;
  taskContext?: { taskId: string; assignee: boolean };
  policyVersion: string;
}
```

该上下文在 Ledger Backend 中由认证、组织、实例和流程状态建立；SDK 不接收角色查询逻辑。授权对象包括 Ledger、Sheet、Range、Field；操作包括 CREATE、VIEW、EDIT、DELETE、SUBMIT、START_WORKFLOW、APPROVE、REJECT、WITHDRAW、TRANSFER、COPY、PASTE、INSERT_ROW、DELETE_ROW、INSERT_COLUMN、DELETE_COLUMN、FORMAT、EXPORT、PRINT、MANAGE_ATTACHMENTS、RESTORE、PUBLISH_DEFINITION。CREATE 的上下文使用目标定义/部门，创建成功后再以具体 ledgerId 求实例权限。

默认拒绝。有效授权由 tenant/对象可见性硬边界、明确授权、状态限制和操作约束共同决定；显式 deny 优先。角色多个 allow 可以合并，但子范围 allow 不得突破台账禁止、完成态锁定或敏感字段 deny。Field 覆盖的可编辑区域需和 Range/Sheet 策略求交；多选区命令必须整个影响范围通过，否则首版原子拒绝，不能只修改允许的半片范围。

### 7.2 SDK 只消费已计算策略

```ts
interface SpreadsheetAccessPolicy {
  version: string;
  canEdit: boolean; // 有编辑通道；实际单元格还需通过范围规则
  canCopy: boolean;
  canPaste: boolean;
  canInsertRow: boolean;
  canDeleteRow: boolean;
  canInsertColumn: boolean;
  canDeleteColumn: boolean;
  defaultRangeAccess: "readonly" | "editable";
  sheets: SheetAccessRule[];
  ranges: Array<{
    sheetId: string;
    range: CellRange;
    editable: boolean;
    copyable: boolean;
    hidden: boolean; // 展示隐藏，不构成机密数据隔离
    reasonCode?: string;
  }>;
}
```

`setAccessPolicy(policy)` 是对原 SDK 的拟增契约，和 `readonly` 求交；`readonly=true` 是全局编辑否决。范围规则包含格式、结构、对象编辑等动作时应使用明确 action set，不把 FORMAT 等隐含为 EDIT。字段策略先由 Ledger Binding 层解析成范围规则。Toolbar、右键、键盘、粘贴、填充、拖拽、撤销/重做及插件命令都经过相同检查。服务器每次保存重新鉴权，policyVersion 只用于发现过期，不能代替鉴权。

正式 DTO 的每条 Sheet/Range 规则须补充 `allowedActions`（如 set-value、format、copy、paste、insert-row、delete-row、object-edit）；上例 boolean 是这些动作的便捷摘要，不是完整授权依据。服务端将重叠规则编译为确定的交集；规则数组顺序不能改变结果。未命中规则取对应默认动作，默认 readonly；合并范围按全部覆盖单元格求交。只有 VIEW 的用户不能通过修改本地能力获得服务端写入权限。

策略更新必须作为 SDK 队列中的屏障：停止接收新写命令，重新检查未执行命令，取消已不允许提交的未确认输入，隔离异步旧回调，再发布新能力；已提交本地草稿不得静默声称已保存。撤销也检查当前权限，不能以历史操作原来有权限为由写回锁区。服务端保存事务提交前再次核对状态和策略版本，防止校验完成后、CAS 提交前发生撤权。事件推送可以使用宿主 SSE/轮询，重连和重新聚焦时刷新权限；旧 Spreadsheet WebSocket 不承担此职责。

### 7.3 隐藏、复制与机密数据

`hidden` 只代表 UI 展示隐藏；如果用户无 VIEW 权限，服务端不能把原始值、公式、缓存、批注、图片或可推断该值的派生数据发到浏览器。只用隐藏 Sheet/Cell 会泄露数据。

首版完整 Snapshot 写入仅对有完整工作簿读取权限的编辑者开放。需要机密字段裁剪的查看者拿服务器生成的受限 ReadView，禁止把裁剪后的快照整份覆盖保存；暂不支持“局部可见文档的整包编辑”。未来通过字段/命令 Patch 在服务端保留不可见部分。无法安全裁剪跨表公式依赖时拒绝该视图或展示服务端允许的结果，不用隐藏公式栏代替处理。

EXPORT/PRINT/统计/附件/历史版本读取执行同一数据可见性策略；版本链接不是永久授权。COPY 控制应用提供的复制入口，无法阻止有权看到数据的人截图或手工抄录，不能承诺浏览器内的绝对防泄漏。审批权与编辑权独立，旧工作表密码不进入用户角色模型。

## 8. Data Model：数据库与对象存储

逻辑关系使用支持事务和索引的关系数据库描述，不在本阶段指定新数据库产品。避免为任意单元格建立 EAV 表，也不将全部台账元数据埋进 Workbook JSON。

| 存储实体                                                 | 关键字段/约束                                                                                                   | 存储位置                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| ledger_definition / definition_version                   | tenant、definitionId、version、schema、rules、templateRef、publishedAt；发布版本不可变                          | DB；大模板在对象存储                            |
| ledger_instance                                          | id、tenant、definitionVersionId、departmentId、period、status、headRevisionId、ledgerVersion、owner             | DB；列表主要查询源                              |
| ledger_revision                                          | id、parentId、ledgerId、kind、manifestRef/hash、schemaVersion、codecVersion、createdBy、createdAt、restoredFrom | DB 元数据；不可变内容对象存储                   |
| revision_manifest                                        | snapshotRef、bindingMapRef、附件版本列表、definitionVersion、projectionVersion、contentHash                     | 小对象可 DB，较大放对象存储；一个不可变版本边界 |
| ledger_projection                                        | ledgerId、revisionId、extractorVersion、validationStatus、typedFields                                           | DB；只允许服务端抽取器写                        |
| record_projection                                        | ledgerId、revisionId、tableRangeId、recordId、typedValues                                                       | DB；唯一键包括版本和稳定 recordId               |
| field_index                                              | definition/fieldId、类型化值、ledgerId、recordId、revisionId                                                    | 按已声明 indexed 字段建立；不要索引每个 Cell    |
| attachment / attachment_version                          | id、tenant、ledgerId、recordId?、objectKey、hash、mime、size、scanStatus                                        | DB 元数据；原文件/缩略图对象存储                |
| workflow_binding / workflow_projection / workflow_action | ledger、submissionRevision、providerRef、version、status、idempotencyKey                                        | DB；引擎保存流程执行事实                        |
| permission_policy / grants                               | policyVersion、scope、subject/role/department、allow/deny                                                       | DB；权威策略                                    |
| audit_log / outbox / inbox / idempotency_record          | actor、object、event、requestId、version、hash、providerEventId                                                 | DB；审计追加，唯一键去重                        |

LedgerInstance 的元数据与 Workbook 快照是不同对象；附件关联和业务字段绑定属于 Revision Manifest，不能塞进单元格字符串。SDK 自己的 `extensions` 继续保存图表/透视表等文档扩展，应用的 manifest 不要求引擎理解流程和附件域。

列表查询优先过滤 tenant、部门、期间、业务状态，再按定义字段查询；游标排序使用稳定的 `(updatedAt,id)` 或指定业务排序键。跨台账统计仅汇总同一语义/类型/币种口径的字段，不因为列标题同为“金额”就直接相加。搜索范围明确区分台账元数据、声明可搜索字段和可选全文索引，首版不承诺所有任意单元格全文搜索。

同步保存事务提交“新 Revision + 当前业务投影 + head 指针 + 审计”，列表及审批读取该 head 对应投影。大规模全文/报表副本可以异步构建并显示 `indexedRevisionId`；工作流与权限条件不得使用落后的异步索引。重建投影按定义/抽取器版本执行，保留提交时证据，不覆盖历史审批变量。

### 8.1 必须落到迁移和查询中的约束

- 所有业务关联带 tenantId；数据库复合外键或 Repository 等效约束阻止跨租户引用。revision.parentId 必须属于同一 ledger；head 指向已完整提交的 revision。
- 一份 Manifest 至少含 `manifestVersion / definitionVersionId / snapshotRef+hash / bindingMapRef+hash / attachmentVersions / metadataAtRevision / extractorVersion / rulesVersion`。服务器填入可信部门、期间、名称等 `metadataAtRevision`；审批还固定 `variablesAtSubmission + workflowPolicyVersion`。以后改变部门名称或台账元数据不能改写过去的审批依据。
- PATCH 名称等展示元数据使用 ledgerVersion 和审计；部门、期间等影响查询、权限或审批的元数据只能在 draft/returned 经业务变更事务提交，新建 Revision（允许复用正文对象）、重新计算投影及系统展示值。若工作区 dirty，先保存或解决冲突再做此变更，不能悄悄覆盖当前输入。
- 元数据索引建议 `(tenantId, departmentId, status, period, updatedAt, id)`，实际按查询计划选取复合子集；修订索引 `(tenantId, ledgerId, createdAt, id)`；字段索引 `(tenantId, definitionId, fieldId, typedValue, ledgerId)`，与 headRevision 联接避免重复计入历史值。具体数据库的 JSON/decimal/index 实现列为 NEED VERIFY。
- `field_index` 只为明确需要筛选的关键字段建立；首个定义可使用类型化投影列/受控 JSON 路径索引，不必第一轮实现通用 EAV 查询引擎。金额索引带精度/币种；报表返回 `asOf` 与口径版本。
- SDK Snapshot 负责文档图片引用；Attachment 负责业务文件。两者可复用授权 AssetStore，但需分别记录引用与 GC 可达性。历史快照的图片不能只存即将过期的签名 URL，codec/asset resolver 负责把稳定 assetId 转成临时 URL，临时凭证不进入 Snapshot。

应用 API 将 snapshot 当不透明文档资产传输；维护者在 codec/迁移接口里看到 `dataFormat: luckysheet` 符合父方案兼容约束，不要求为了公开 API 去品牌而篡改历史数据格式标记。

## 9. Persistence Model：保存、恢复与冲突

### 9.1 版本与保存职责

分开四个标识：`clientEditSeq` 是当前会话已提交编辑序号；SDK 内 revision 是本地命令状态；`revisionId` 是服务器不可变文档修订；`ledgerVersion` 是业务元数据/状态并发版本。撤销是产生新编辑，不能删除已存在的服务器 Revision。

首版保存**完整 Snapshot + BindingMap + Attachment Manifest**。手动保存和自动保存走同一管线；手动保存可给修订加 checkpoint 标签，提交/恢复的修订固定保留，普通自动保存版本按保留策略压缩或清理。所有引用中的已提交修订不能因自动保存清理而丢失。

建议自动保存：已提交编辑后 2 秒防抖、最长 15 秒尝试一次，单会话只允许一个保存请求在途；这些时间是可调设计值。IME composition/未确认编辑不触发半成品保存，`commitEdit()` 在手动保存/提交时明确结束当前编辑；不能以失焦事件是否发生猜测。

### 9.2 保存协议

```text
编辑提交 → clientEditSeq 增加 → dirty
  → 校验/准备快照及绑定 → 记录本次 seq=N
  → 上传不可变暂存对象并校验 hash/大小/归属
  → 服务端按当前权限校验差异、抽取字段/执行业务规则
  → DB 事务 CAS 更新 head + 新 Revision + 同版本投影 + 审计/outbox
  → 返回 revisionId、ledgerVersion、ackSeq=N
  → 只有当前 seq == N 才变 clean；后续编辑继续 dirty 并排下一次保存
```

请求必须含 `expectedHeadRevisionId`、`expectedLedgerVersion`、`policyVersion`、幂等键、定义版本、候选对象引用与内容 hash。幂等键按 actor/ledger/动作作用域唯一，同 key 不同内容返回冲突；先查已成功记录，再判断重复请求的旧版本条件，避免丢失成功响应后无法恢复。

服务器不信任前端 claims：校验实际对象内容、tenant、绑定和字段类型，并比较所有受保护区域及文档结构的修改。单元格公式、批注、图片、隐藏 Sheet 和扩展数据也属于差异范围；只抽取关键字段不能证明整包符合编辑权限。未实现某种差异校验时，限制对应写能力或要求更高权限，不能默许通过。

对象存储和 DB 无共同事务：先写不可变暂存对象，确认内容可读，再在 DB 事务提交引用；失败的未引用对象延迟 GC，提交后的引用不可提前清理。不能先显示保存成功再异步上传正文。文件 hash 用于完整性与去重，不证明用户有权修改其内容。

### 9.2.1 草稿可保存不完整业务输入

区分三层校验：协议/schema/大小和引用合法性是保存的硬门槛；授权/系统字段/结构约束也是硬门槛；必填、金额范围、业务日期等业务规则允许在草稿中暂时不满足。保存后返回 `validationStatus: invalid|incomplete|valid` 和带稳定 fieldId/recordId 的错误，UI 可以同时显示“已保存”和“有 2 项待完善”，提交保持禁用。

字段抽取结果必须显式区分 missing / invalid / valid，invalid 原输入保留在正文，投影不把它强制变为 0、空串或上一版本有效值。业务汇总默认只纳入 valid 且符合状态口径的数据，返回排除数量，避免静默漏算；提交要求当次服务端业务校验全部通过。422 用于保存硬门槛失败或提交业务校验失败，不用于拒绝保存普通的未完成草稿。

异步公式计算期间可保存已确认原始输入及标为 pending 的显示缓存；因为首版关键字段由服务端规则计算，审批不依赖该缓存。公式导致锁定单元格缓存变化时，差异检查必须区分输入/公式/格式与可验证派生缓存：只允许受支持公式/规则对应的派生变化，不能让客户端把任意锁区变化标记成 recalculation 而通过。没有该验证能力时，对应公式编辑路径不得开放。

### 9.2.2 编辑、正文和附件的一致采样

SaveCoordinator 在确认编辑后从 SDK 取得最近已提交 revision 的副本，和同一事务发布的 BindingMap 一起组成候选；Attachment Manifest 的本地变更也递增独立应用 dirty 序号。保存确认点使用 `{documentSeq, bindingSeq, attachmentSeq, metadataVersion}`，`clientEditSeq` 可作为该向量的会话级单调编号。仅收到 Cell 事件不能证明附件已保存。

手动保存/提交先建立会话屏障，确认编辑，捕获候选；提交等待该候选的服务器确认后，再核对本地没有更新编辑及 expected head。保存等待期间如果用户继续输入，提交应重新保存最新候选或提示待保存，不能把旧 revision 误当当前屏幕内容提交。请求超时保留原候选与幂等键；用户后续编辑构成下一候选，不复用同键改变请求内容。页面离开提示本地未保存状态，`beforeunload`/`sendBeacon` 只能辅助，不是可靠保存协议。

### 9.3 冲突、崩溃与增量演进

CAS 失败返回 `REVISION_CONFLICT` 和当前版本；前端暂停自动保存，保留本地草稿，提供“重新载入服务端版本”“查看差异”“按权限保存为副本”。首版不做自动最后写入覆盖，不对结构变更盲目三方合并。租约/编辑占用提示可降低碰撞，但服务器 CAS 仍必须存在。

本地恢复按 tenant/user/ledger/baseRevision/clientSession 隔离。可在 IndexedDB 保存最近快照/草稿操作，并标记仅本机、未保存；恢复前重新鉴权、检查定义和服务器 head，权限撤回时不继续渲染缓存。存储配额、禁用存储或失败时明确提示；不能承诺每次崩溃都无损。退出登录清理或按组织策略禁用本地缓存，敏感台账默认不启用持久草稿。

ChangeSet 在下一阶段逐步引入：只记录已进入命令系统的版本化语义操作，包含 baseRevision、operationId、clientSeq、目标稳定 ID、前置条件、参数及覆盖范围。过渡期旧入口不能生成完整命令日志时，仍以完整 Snapshot 为权威，变更事件只用于触发保存。

只有服务器可校验并确定重放某类操作时才接受增量保存；未知操作、schema 变化、结构迁移、导入和恢复回退到完整快照。定期生成 checkpoint，限制重放长度，并校验重放结果 hash。可保留父 Revision、operationId 和稳定记录身份，为未来协同提供基础，但这不等于已经支持 OT/CRDT；协同届时单独确定冲突语义和撤销范围。

上传 `sha256` 校验的是传输对象字节；重放对照的 `documentHash` 使用固定 codecVersion 的规范序列化，明确定义键顺序、缺省值、数值和数组顺序，去除个人视图及非权威计算缓存。二者不能混用，不能因 JSON 键顺序不同误报冲突，也不能排序有顺序含义的 Sheet/规则数组。checkpoint 记录基准 Revision、操作序号边界及该 documentHash；仅在这一种命令重放通过后才逐项扩大增量范围。

恢复旧版本创建新的 head Revision，记录 `restoredFromRevisionId`，重新抽取投影并鉴权；不删除后续历史，不倒退 Workflow 事件，不恢复过期授权/已撤销附件链接。审批中/完成态默认禁止原地恢复；更正走独立策略或新台账副本。

## 10. Toolbar Architecture

### 10.1 所有权与 Action API

自有 Toolbar 属于框架无关的 Spreadsheet UI 层，由 Ledger Shell 布局和配置；保存/提交/发起流程不混入格式工具栏。Toolbar 不导入 `src/global/api`、Store、controller 或旧 CSS class。

```text
UI Button → Toolbar Action → 正式 Command → Spreadsheet SDK.execute
                                          → 权限/事务 → Runtime
业务按钮 → Ledger Action → Ledger Backend（保存/提交/附件/授权导出）
```

```ts
interface ToolbarAction<T> {
  id: string; // UI 身份，与命令可多对一
  labelKey: string;
  icon: ProductIconName;
  shortcut?: string;
  getState(ctx: ToolbarContext): {
    visible: boolean;
    enabled: boolean;
    reasonCode?: string;
    checked?: boolean | "mixed";
    value?: T;
    busy?: boolean;
  };
  run(ctx: ToolbarContext, input: T): Promise<void>;
}

interface ToolbarContext {
  sdk: SpreadsheetInstance; // 仅公开接口
  selection: SelectionSnapshot;
  selectionVersion: number;
  access: SpreadsheetAccessPolicy;
  ui: ToolbarUiService; // 打开自有颜色/格式面板及消息
}
```

拟补 SDK 查询：`getSelection()`、`getSelectionState()`（混合样式/合并状态）、`getCapabilities()`（supported/enabled/reason）、`getHistoryState()`、`getEditingState()`、`commitEdit()`、`revealRange()`、`setAccessPolicy()`；事件包括 selection/style/history/editing/capability/policy/workbook-change。这些在当前仓库未实现，必须先做 facade 契约，不能用内部 DOM 模拟查询。

打开下拉前保存 SDK 提供的 SelectionSnapshot，操作带预期 selectionVersion/document revision；点击 Toolbar 不丢编辑焦点语义，确认后恢复网格焦点。选择已过期或权限改变时重新确认目标，不能将旧颜色弹窗应用到另一个 Sheet。组合格式是一条事务；mixed 点击约定为统一设为 true，再次点击为 false，命令本身使用显式值，不用不可重放的 toggle。

### 10.2 正式命令目录与旧能力映射

原 SDK 文档 §4 明确示例名是 `sheet.set-cell-value`，§4.2 确定了命令覆盖范围，尚未命名完整目录。本设计保留该名字，按同一 `资源.动词-对象` 风格新增 `sheet.set-format` 等名称；其余名称是本轮提案，不声称它们已经在原文或源码中实现。**旧实现列仅供 SDK 维护者编写适配**，不是给 Toolbar 的调用入口。参数统一包含稳定 sheetId、明确 ranges/target，行列零基、范围闭区间。

| Toolbar Action / 能力  | 正式命令或查询                                                              | 参数核心                                     | 源码能力/缺口                                                                        |
| ---------------------- | --------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| 撤销 / 重做            | `workbook.undo` / `workbook.redo`                                           | 当前实例历史                                 | `api.undo/redo` L5860/L5885；内部方法命名相反，按行为测试映射                        |
| 字体 / 字号            | `sheet.set-format`                                                          | `patch.fontFamily/fontSizePt`                | `api.setRangeFormat`；旧 ff/fs 在 bridge 转换                                        |
| 粗体 / 斜体            | 同上                                                                        | `patch.bold/italic` 显式 boolean             | 旧 bl/it，不能让业务携带这些缩写                                                     |
| 下划线 / 删除线        | 同上                                                                        | `patch.underline/strikethrough`              | 旧 un/cl，需验证富文本分段格式                                                       |
| 文字色 / 背景色        | 同上                                                                        | `patch.textColor/backgroundColor`            | 旧 fc/bg，颜色值校验和清除语义                                                       |
| 水平 / 垂直对齐        | 同上                                                                        | `patch.horizontalAlign/verticalAlign`        | 旧 ht/vt 的枚举映射在 bridge                                                         |
| 边框                   | `sheet.set-borders`                                                         | ranges、edges、style、color、clear           | `setCellFormat('bd')` 与 borderInfo；需专门范围事务                                  |
| 合并 / 取消合并        | `sheet.merge-cells` / `sheet.unmerge-cells`                                 | mode、ranges                                 | `setRangeMerge/cancelRangeMerge`；数据丢失确认，业务明细区约束                       |
| 数字格式               | `sheet.set-format`                                                          | `patch.numberFormat`，格式代码及业务类型分离 | `ct` 要求实际对象形状，旧注释示例与实现不一致，按源码适配                            |
| 冻结 / 取消冻结        | `sheet.set-freeze`                                                          | rowCount、columnCount；0/0 取消              | `setBothFrozen/cancelFrozen`；坐标映射及保存回放需测试                               |
| 开启筛选 / 条件 / 清除 | `sheet.set-filter` / `sheet.clear-filter`                                   | range、criteria                              | `setRangeFilter` 仅开关，不等于完整条件 API；筛选服务需补齐                          |
| 升降序 / 多级排序      | `sheet.sort-range`                                                          | keys、direction、headerRows                  | `setRangeSort/Multi`；完整记录排序与 BindingMap 同事务                               |
| 查找                   | `sdk.find()` 查询；Action 打开自有面板                                      | scope、text、case、limit                     | `api.find`；普通查询不写历史；首版不开放不受限正则                                   |
| 替换 / 全部替换        | `sheet.replace-values`                                                      | scope、search、replacement、expectedRevision | `api.replace`；受权限、绑定和事务控制                                                |
| 插入行 / 删除行        | `sheet.insert-row` / `sheet.delete-row`                                     | index/count 或明确 range                     | `api.insertRow/deleteRow`；绑定区需要结构计划                                        |
| 插入列 / 删除列        | `sheet.insert-column` / `sheet.delete-column`                               | 同上                                         | `api.insertColumn/deleteColumn`；定义字段列默认禁止随意删除                          |
| 图片                   | `sheet.insert-image` / `sheet.update-image` / `sheet.delete-image`          | assetRef、anchor、geometry                   | `api.insertImage/deleteImage` 有基础入口，更新与授权资源需封装                       |
| 批注                   | `sheet.add-comment` / `sheet.update-comment` / `sheet.delete-comment`       | target、text、commentId                      | `controllers/postil`，缺少完整独立公开 API，新增内部 bridge，不让 Toolbar 导入控制器 |
| 数据验证               | `sheet.set-validation` / `sheet.clear-validation`                           | ranges、受限 rule                            | `api.setDataVerification/deleteDataVerification`                                     |
| 条件格式               | `sheet.set-conditional-format` / `sheet.remove-conditional-format`          | stable ruleId、ranges、rule                  | `api.setRangeConditionalFormat*`；旧下标到 ruleId 的映射                             |
| 工作表新增/重命名/删除 | `sheet.add-worksheet` / `sheet.rename-worksheet` / `sheet.delete-worksheet` | sheetId/name                                 | `api.setSheetAdd/Name/Delete`；模板结构权限                                          |
| 视图缩放/定位          | `view.set-zoom` / `sdk.revealRange()`                                       | zoom/target                                  | `setSheetZoom/setRangeShow/scroll`，视图不作为业务 Revision 修改                     |
| 导入                   | 文件 Action → `file.parse-workbook` 插件 → Ledger 校验候选稿                | fileRef、format、mapping preview             | 本地没有完整已接通导入链；候选不能直接覆盖已提交文档                                 |
| 导出                   | Ledger 导出任务 → 授权 Revision → `file.export-workbook` 转换能力           | revision、format、authorized scope           | 旧 exportXlsx 外部服务模式不可直接复用为权限边界                                     |
| 打印                   | Ledger 打印任务 → 授权 Revision → `print.render-document` 能力              | revision、page setup、scope                  | 缺实现，capability=false，待专项验证                                                 |

具体旧位置见 [api.js](../src/global/api.js)、[menuButton.js](../src/controllers/menuButton.js)、[postil.js](../src/controllers/postil.js) 和 UI 审计。`setRangeFormat` 等当前错误/回调并不一致；不能一律把 success 回调包成 Promise 后就宣称完成，缺回调会悬挂，部分修改失败需要额外原子性实现。

具体证据：[setRangeFormat](../src/global/api.js#L2961) 在循环修改之后才复制 `file.data`，失败分支写回的仍是修改后的副本，末尾 success 条件体为空；[setSingleRangeFormat](../src/global/api.js#L2908) 逐 Cell 调用写值 API 并输出坐标日志。必须先校验全部范围并建立事务前状态、统一历史和完成信号；尚未完成时不开放多范围格式成功承诺。

### 10.2.1 Action 调用与可重放命令

```ts
// 拟定公开 UI API。Action 可以打开菜单，Command 只能接收已确定的语义参数。
interface ToolbarActions {
  execute(actionId: string, input?: unknown): Promise<ActionOutcome>;
  getState(actionId: string): ActionState;
  subscribe(listener: (changedIds: string[]) => void): () => void;
}
// 示例：toolbarActions.execute('text.weight', { value: 'bold' })
// → sdk.execute('sheet.set-format', {
//     sheetId: 'sheet-main', ranges: [{ row: [5, 6], column: [0, 2] }],
//     patch: { bold: true }, expectedRevision: 42, policyVersion: 'policy-8'
//   })
```

Action ID 建议 `history.back/forward`、`text.family/size/weight/slant/underline/strike/color`、`cell.fill/alignment/borders/merge/number-display`、`data.freeze/filter/sort/find/replace`、`structure.rows/columns`、`insert.image/comment`、`rules.validation/conditional`、`document.import/export/print`；这些是控件身份，不与 Command 建立机械一对一关系。下拉取消返回 cancelled，成功返回 completed；不把取消当错误弹窗。

`sheet.set-format.patch` 省略字段表示不修改，`null` 表示清除该显式样式并回到继承默认；字体为受允许的 familyId，字号使用 pt，枚举使用语义字符串。命令不能接收 UI event、HTML、函数、旧 `ff/bl/ct` 字段或未解析的当前焦点。命令分类分别声明 document（进入历史/保存）、view（仅会话）、query、file-job。冻结/筛选首版按文档配置保存，缩放/临时查找选区按个人视图不产生业务 Revision；将来个人筛选另建 ViewState，不偷偷改变现有快照语义。

命令至少返回 `{commandId, revision, affectedRanges}`，失败是稳定 error code；query 有结果上限，文件任务使用 operation receipt，不挤入文档撤销栈。撤销/重做只影响当前会话文档和绑定，不能撤销已提交工作流或后端权限。功能已支持、已安装、被配置启用、获当前权限、当前目标合法五个判断分别给出原因，避免一个 disabled boolean 掩盖所有缺口。

### 10.3 工具栏布局与分期

首行常驻：撤销/重做、字体/字号、字形、颜色、对齐/边框、数字格式、更多。数据组：合并、冻结、筛选/排序、查找替换、结构操作。插入/规则组：图片、批注、验证、条件格式。文件组：导入/导出/打印显示 Ledger 授权任务入口，缺少 capability 时明确不可用。

既有基础功能按 SDK P0 保留，不因为自有 Toolbar 尚未全部覆盖而静默删掉。产品填报模式可禁用结构、复杂格式和高级插件；通用 SDK 能力仍按原规划推进。新 Toolbar 按组替换并设置功能开关，一组通过编辑、错误、撤销、选择状态、键盘和权限测试后，才关闭对应旧入口。UI 事件不模拟旧按钮 click，不保留隐藏旧 Toolbar 作为必需的业务执行器。

## 11. Theme / Icon Architecture

### 11.1 Token 层级和初始规格

原始色板/尺寸 → 语义 token → 组件 token → CSS 与 Canvas theme adapter。业务 UI 只引用语义名，兼容皮肤在 SDK 内把令牌映射到旧选择器；颜色和图标不携带 Ledger/Workflow 逻辑。

| 类别            | 建议语义 token / 初始值                                                        | 说明                                                                      |
| --------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| color           | `text.primary #1f2937`、secondary `#64748b`、brand `#2563eb`、danger `#b91c1c` | 先交付浅色，状态同时有文字/图标；对比度实测                               |
| background      | page `#f8fafc`、surface `#ffffff`、hover `#f1f5f9`、selected `#dbeafe`         | SDK 表面和业务表面均可单独覆盖                                            |
| border          | subtle `#e2e8f0`、strong `#94a3b8`、focus `#2563eb`，1px                       | 不用颜色覆盖用户设定的单元格边框                                          |
| font / fontSize | UI system stack，12/14/16/20px；文档字体独立、保留 pt                          | 明确像素和印刷字号单位，避免数据往返改变字号                              |
| spacing         | 4/8/12/16/24/32px                                                              | 工具栏紧凑但保留可点击区域和键盘焦点                                      |
| radius          | control 4px、panel 8px、dialog 12px                                            | Grid 单元格保持直角                                                       |
| shadow          | menu、panel、dialog 三档                                                       | 不为每个按钮加阴影                                                        |
| zIndex          | base 0、sticky 10、panel 20、popover 100、dialog 200、toast 300                | 在宿主 stacking context 内分层；旧 100003/1000000000 需适配，不能相互竞赛 |

所有尺寸是初始设计值，由可访问性/浏览器验收调整。应用 Header、Ledger 状态徽标、Workflow Panel 和自有 Toolbar 共用 token；SDK UI 扩展使用同一主题协议而非 import 业务 CSS。

```ts
interface SpreadsheetCanvasTheme {
  canvasBackground: string;
  gridLine: string;
  headerBackground: string;
  headerText: string;
  selectionBorder: string;
  selectionFill: string;
  readonlyOverlay: string;
  defaultCellText: string;
  defaultCellFontFamily: string;
}
```

`resolveTheme(tokens)` 生成 CSS Variables 和显式 Canvas 对象，SDK `setOptions({theme})` 同时更新并失效相应绘制/文字度量缓存；主题不修改 Snapshot 中用户设定的单元格颜色、字体和业务高亮。暗色模式不能简单反转整个 Canvas；先明确“界面暗色、文档白纸”策略，真正文档暗色为后续兼容项。服务端打印/导出固定文档主题与字体资源，不继承操作者的系统暗色设置。

### 11.2 Icon Layer 与选型

```text
<Icon name="format.bold" />
  → ProductIconRegistry（稳定语义名、尺寸、title/aria）
  → Icon Adapter（按需导入 SVG / 本地自有 SVG）
  → Vue / React / Vanilla 渲染
```

推荐自有语义映射层，以按需 SVG 为默认资产形式；Lucide 可作为通用导航/操作图标候选，边框、合并、冻结等表格专用图标使用可维护的本地 SVG。它不是强制底层依赖，也不能因选择 icon 而引入另一个 UI 框架。

| 选项                                         | 许可/体积/接入                                                                             | 决策                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| 保留旧 iconfont/Font Awesome 为产品 Icon API | 对内部 class/字体文件依赖强，难按图标裁剪                                                  | 仅兼容引擎 UI 使用，业务层禁止引用                         |
| 自有静态 SVG 小集合                          | 无框架、精确控制资产和体积；需维护设计及来源记录                                           | 表格专用图标首选，语义名保持稳定                           |
| Lucide 经 Adapter                            | 官方提供 Vanilla、React、Vue SVG 接入及按需裁剪；ISC，部分派生 Feather 图标另保留 MIT 声明 | 适合通用图标；锁定版本、逐图标导入，实际包体由样例构建测量 |

相关依据见 [Vanilla 指南](https://lucide.dev/guide/lucide)、[按需导入与根节点范围](https://lucide.dev/guide/lucide/getting-started)、[React](https://lucide.dev/guide/react)、[Vue](https://lucide.dev/guide/vue) 和 [许可](https://lucide.dev/license)。不引用固定“每个图标若干 KB”的未经实测数字；避免导入整个 icons 对象，不在全 document 自动扫描/替换 SVG。框架包装包名和支持版本以实施时的锁定版本验证，不照搬旧教程。

以上官方资料于 2026-09-13 复核。长期维护策略是固定资产版本、保存许可/来源、保持 ProductIconName 稳定；上游图标重命名只改 adapter。先在六图标样例记录 JS/SVG gzip 增量，再对照全量导入的负例确认 tree shaking 生效；不以“支持 tree shaking”代替构建证据。Vanilla 由 adapter 创建自己拥有的 SVG 节点，Vue/React 包装使用各自组件，选择哪一个随首个宿主框架确定。复杂条件格式图标属于文档语义，继续走 SDK Canvas 资源体系。

## 12. Luckysheet De-branding Plan

| 层级             | 当前/下一阶段必须做                                                                          | 后续做                                        | 没有必要做                                            |
| ---------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------- |
| Level 1 用户视觉 | 产品新入口、Header/名称/保存、隐藏 infobar、替换主 Toolbar 和品牌文案、禁默认外链/不完整插件 | 全部内部弹窗、辅助图标、Canvas 与复杂插件皮肤 | 删除公式帮助或网格交互来掩盖品牌                      |
| Level 2 公开 API | 自有 facade、类型、错误、命令与快照容器；应用依赖 lint 边界                                  | 原 SDK M2/M3 的完整实例和命令实现             | 在业务层包装 window 对象后继续暴露它                  |
| Level 3 资源依赖 | 产品明确资源清单、禁止运行时默认 CDN、许可资产清点；不复制 demo 到产品入口                   | 插件本地化、字体/sprite 替换、按需裁剪        | 为隐藏 Network 文件名打乱构建或删除法律声明           |
| Level 4 内部解耦 | 上游依赖限定在 SDK 内部 legacy bridge/codec 兼容区域，建立回归和资源责任清单                 | 实例 Store/服务/DOM、命令/主题接口逐条迁移    | 大规模 rename `luckysheet-*`、全面重写/迁移 TS/jQuery |

目标是正常使用时没有上游产品视觉和 API 暴露；DevTools、许可证、source map 和兼容数据保留可追溯来源合理且必要。根 LICENSE、版权和第三方许可完整保留，不把“去品牌化”写成“删除版权”。详见 [UI 审计许可清单](./luckysheet-ui-audit.md)。本阶段未删除任何上游文件。

## 13. Backend API Boundary

以下是以 Ledger 聚合为边界的 `/api/v1` 草案。Workbook 是台账 Revision 的资产，首版不另设可绕过台账权限的通用 `/workbooks/:id` 写接口；Workflow 通过关联资源进入，不暴露任意引擎地址。

| 用例               | 建议 API                                                                                                                     | 关键契约                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 定义列表/新建      | `GET/POST /ledger-definitions`                                                                                               | tenant/管理权限，分页与唯一业务 code                                                              |
| 编辑/发布定义版本  | `POST /ledger-definitions/{id}/versions`；`POST /definition-versions/{id}/publish`                                           | 草稿验证、模板资产、规则/绑定检查；已发布版本不可覆盖                                             |
| 台账查询/创建      | `GET/POST /ledgers`                                                                                                          | department、period、status、definition、typed field filters、cursor/limit；创建绑定已发布定义版本 |
| 读取实例元数据     | `GET /ledgers/{id}`                                                                                                          | 当前 head、业务状态、定义版本、ledgerVersion；不默认返回全部正文                                  |
| 读取工作区/版本    | `GET /ledgers/{id}/workspace?revisionId=...`                                                                                 | 权限结果、授权文档引用、BindingMap、定义摘要、读模式；历史同样鉴权                                |
| 改名称/元数据      | `PATCH /ledgers/{id}`                                                                                                        | If-Match ledgerVersion；字段白名单；不会静默修改表内数据                                          |
| 准备保存上传       | `POST /ledgers/{id}/revision-uploads`                                                                                        | 返回短期、范围受限的上传凭证，校验大小/hash，创建本身不算保存                                     |
| 自动/手动保存      | `POST /ledgers/{id}/revisions`                                                                                               | CAS、幂等键、manifest、candidate hash、source；返回确认 Revision/ackSeq                           |
| 修订列表/差异      | `GET /ledgers/{id}/revisions`；`GET /ledgers/{id}/revision-diff?from=...&to=...`                                             | 分页、授权裁剪；无权限字段的差异也不泄露                                                          |
| 恢复               | `POST /ledgers/{id}/restore`                                                                                                 | fromRevisionId + expected head；生成新修订，不倒退流程                                            |
| 提交/发起流程      | `POST /ledgers/{id}/submissions`                                                                                             | 已保存 Revision、expectedLedgerVersion、幂等；返回 submissionId/operationId                       |
| 流程概览/任务/历史 | `GET /ledgers/{id}/workflow`、`GET /workflow-tasks`、`GET /ledgers/{id}/workflow-history`                                    | 标准 DTO、游标分页，不暴露引擎私有对象                                                            |
| 审批/驳回/转交     | `POST /workflow-tasks/{taskId}/actions`                                                                                      | action、意见/目标、expected workflow version、idempotencyKey；校验任务归属                        |
| 撤回               | `POST /ledgers/{id}/workflow-actions`                                                                                        | action=withdraw、绑定 ID、版本与幂等；禁止任意状态改写                                            |
| 附件准备/完成      | `POST /ledgers/{id}/attachment-uploads`；`POST /ledgers/{id}/attachments`                                                    | 完成时确认 hash、扫描状态、业务归属；文件上传和关联分开                                           |
| 附件列表/下载/移除 | `GET /ledgers/{id}/attachments`、`POST /attachments/{id}/download-grants`、`DELETE /ledgers/{id}/attachments/{attachmentId}` | 重新鉴权，删除是移除当前关联，历史引用受保留策略约束                                              |
| 读取/管理权限      | `GET /ledgers/{id}/capabilities`；管理端 `PUT /ledgers/{id}/permission-policy`                                               | 返回已计算能力；策略修改独立鉴权、版本和审计                                                      |
| 归档/删除          | `POST /ledgers/{id}/archive`；`DELETE /ledgers/{id}`                                                                         | 业务状态/引用约束，默认软删除，有审计；不删审批证据                                               |
| 导入               | `POST /ledger-imports`；`POST /ledger-imports/{id}/apply`                                                                    | 解析预览/字段映射/告警确认；目标实例仍走权限与修订管线                                            |
| 导出/打印          | `POST /ledgers/{id}/exports`                                                                                                 | revision、format、scope、printOptions；返回异步 operation，不直接上传任意全量 JSON 给外部网址     |
| 统计               | `POST /ledger-queries/aggregate`                                                                                             | 允许的字段、分组、指标及租户/权限过滤；不接收 SQL/JS                                              |
| 操作状态/业务审计  | `GET /operations/{id}`；`GET /ledgers/{id}/audit-log`                                                                        | 租户/对象授权、分页；供异步任务和审计面板读取                                                     |

### 13.1 保存与错误示例

```json
{
  "expectedHeadRevisionId": "rev-17",
  "expectedLedgerVersion": 23,
  "policyVersion": "policy-8",
  "definitionVersionId": "defv-3",
  "clientSessionId": "session-a",
  "clientEditSeq": 12,
  "source": "manual",
  "candidate": { "uploadId": "upload-6", "sha256": "..." }
}
```

幂等键在 `Idempotency-Key` 头传递；服务端成功响应含 `revisionId/ledgerVersion/ackSeq/validationSummary`。同步错误使用 `{code,message,requestId,details}`；401 未认证，403 无权，404 不存在或按策略隐藏存在性，409 版本/状态/幂等冲突，422 协议/绑定硬校验或提交业务校验失败，413 超限，429 限流。草稿普通业务校验未通过仍返回成功及 validationSummary，见 §9.2.1。异步流程/导出返回 202 和 operationId，不能把 accepted 显示为完成。

上传对象、附件和下载凭证属于指定 tenant/ledger/actor，短期有效；objectKey 由服务端生成。统计、搜索、分页和历史接口都执行数据授权，不能仅在打开编辑页时校验一次。

分页统一 `{items,nextCursor,hasMore}`，limit 有服务器上限；cursor 绑定排序键、过滤条件和授权主体，换过滤条件后重新开始，不接受客户端传来的 tenant 作为身份。列表项只含元数据、授权的关键字段摘要、validationStatus 和 headRevisionId，点击详情才加载文档。聚合请求仅接受注册 fieldId、允许的 groupBy/metric/filter，响应附口径/币种、asOf、无效记录排除数；按部门和状态统计不能读取未授权记录作为中间聚合再仅隐藏明细。

## 14. Security Considerations

服务端是授权和业务校验的最终边界；客户端选区策略用于体验和提前拒绝。防止直接提交伪造 Snapshot/Record 身份、篡改 department/status、跨租户对象引用、旧策略保存、无权历史下载和任意流程任务操作。

Snapshot 仅接受数据，采用严格 schema/尺寸/深度限制及 JSON 解析；不恢复函数、HTML 回调、服务 URL 或凭据。旧远程数据 `new Function()` 必须从产品接入路径切断，公式计算的动态代码兼容另行治理；严格 CSP 未通过实测前不作支持承诺。

富文本、批注、验证提示、文件名、菜单标题及 Workflow 意见按文本或受限 HTML 处理；URL 限协议，图片/导出服务的远程抓取限制目标和重定向，避免 SSRF。附件限制扩展名/MIME/大小，内容扫描及隔离预览，XLSX 防压缩炸弹/超大关系图/外部链接。导出区分文本与公式，避免把普通业务文本意外转为可执行公式。

Workflow 回调验签、去重、归属和版本核实；Cookie 认证接口落实 CSRF 防护，CORS 采用业务允许列表。日志默认记录 requestId/错误码而非完整工作簿、令牌和附件地址。审计由服务器追加，策略变更、提交、审批、导出、恢复、删除均记录可信 actor 和目标版本。

浏览器本地缓存需遵守数据分级和清理策略；原第三方库、iconfont、字体、构建资产和动态网络清单进入发布核验。安全审计不等于第一轮已解决所有旧依赖问题，未封闭路径须以功能门禁阻止进入生产。

## 15. Compatibility Considerations

SDK Snapshot 继续使用原计划的版本外壳和 Luckysheet 数据 codec；公开业务 DTO 不要求开发者理解 Luckysheet 内部字段，不透明快照仍保留父方案确定的 dataFormat 标记，历史导入放在专用迁移入口。旧 `index/order`、`celldata/data`、`frozen/freezen`、合并、图表/透视元数据等按夹具验证，格式转换在 codec 内部处理。

定义、绑定、投影抽取器、SDK schema、codec 和 Workflow 策略分别记录版本。历史版本由原定义解释；升级定义需要预演字段/范围变化并输出影响清单，不能把模板最新版本直接覆盖所有实例。未知插件扩展保留但对会破坏其引用的操作限制或告警。

父方案 M1 仍是实验性单实例；产品可以用 mock SDK 先验证 Shell，用真实 facade 做受控内部试点，但正式可嵌入发布必须通过 M2/M3 的多实例、P0、生命周期和安装包验收。React/Vue 等适配按原规划实施，不为搭建 Shell 就引入多个框架。SSR 只要求安全 import，当前 Canvas 不要求服务端渲染。

PC 目标浏览器版本、中文 IME、系统字体、DPR、剪贴板权限及打印输出以实测矩阵确认。无障碍策略和移动查看单列验收，不从旧 README 或 Babel target 推断支持。

## 16. Migration Strategy

先建立可验证的依赖边界和业务 fixture，再叠加产品；逐层替换 UI，不同时更换内核、构建、语言和数据源。旧 demo 与产品入口并存，禁止将 demo 初始化配置直接复制为产品默认配置。

数据迁移使用原文件只读副本，生成 neutral manifest、稳定 sheetId/binding/recordId 映射、来源 hash 和转换报告；缺少业务定义的旧工作簿先作为未分类文档导入，经过映射预览后才能成为可提交台账。迁移不删除源文件，失败可回到原版本；保存过新格式后回退旧客户端必须经兼容校验，不能直接降级覆盖。

UI 迁移按 feature flag 切换：Shell/信息栏 → 自有基础 Toolbar → 查询和规则面板 → 复杂插件。兼容皮肤只放在 SDK 内；业务代码不能为了过渡调用旧 DOM/controller。功能暂不支持时禁用并说明原因，不依赖隐藏旧按钮触发行为。

权限与服务端 CAS/校验必须先于真实数据试点；Workflow 在保存、提交修订和权限策略闭环后接入；Theme/Icon 的基础 token 可从 Shell 开始，深层 Canvas 和插件替换在对应能力测试后推进。每个提交可回滚代码；已落库数据通过前向迁移/新 Revision 恢复，不执行不可逆的大表覆盖。

## 17. Implementation Roadmap

详细可独立提交任务见 [next-stage-tasks.md](./next-stage-tasks.md)。这里的 P0–P4 是产品阶段，不替代父方案的 SDK 功能优先级或 M0–M6。

| 产品阶段        | 目标/模块                                                        | 前置依赖                        | 风险与验收                                              | Luckysheet Core           |
| --------------- | ---------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------- | ------------------------- |
| P0 契约与防线   | baseline、SDK facade 类型、依赖边界、Ledger schema、权限语义     | 当前文档                        | mock 与真实能力区分；未支持命令明确拒绝，fixture 可重复 | 基线无；bridge 小范围     |
| P1 业务编辑闭环 | 定义/实例、codec、绑定、DB 权限、CAS 保存、Shell、基础 token     | P0                              | 旧数据往返、拒绝越权/冲突、保存状态准确；可安全内部试点 | 少量 SDK 接缝，不重写引擎 |
| P2 自有编辑 UI  | SDK 状态/事务/Range policy、Toolbar 各组、消息服务、受控结构操作 | P1；父计划实例/命令能力按项完成 | 隐藏旧 Toolbar 后 P0 行为、历史和全部入口权限通过       | 按调用链小步修改          |
| P3 业务流程     | 附件、提交固定修订、outbox/inbox、Workflow mock→ 真实 Adapter    | P1 保存和权限；必要 P2 校验     | 幂等、重复/乱序回调、审批版本不漂移；无直接表格依赖     | 否，使用公开 SDK          |
| P4 发布与扩展   | Canvas/深层皮肤、资源离线、许可、框架适配、导入导出/打印专项     | 对应 P2/P3；SDK M2/M3 发布门禁  | 网络/品牌/包内容/性能/兼容矩阵验收，高级能力逐项开关    | 主题接缝和插件局部改动    |

## 18. Acceptance Criteria

1. Application/Ledger/Workflow/Toolbar 的依赖扫描没有 Store、controller、旧 API、旧选择器或 `window.luckysheet`；只有明确的 legacy bridge 例外。
2. 部门月度费用 fixture 从已发布定义创建实例，元数据、字段、Record、Sheet 身份稳定；标题行不被抽取成 Record。
3. 保存返回同一 Revision 的 Snapshot、绑定、附件 manifest 和关键投影；修改投影接口或伪造字段值不能绕过服务器抽取。
4. 多窗口相同 baseRevision 保存时一方得到冲突；晚到保存响应不能将后续编辑标为已保存；重试幂等返回相同结果。
5. 只读、字段锁定、跨区粘贴/替换、撤销、隐藏 Sheet、结构修改、批注和图片入口均受策略；直接 HTTP 提交同样拒绝越权。
6. 无 VIEW 的数据不进入受限响应、历史差异、导出、索引结果和附件链接；受限 ReadView 不允许全量保存。
7. 按部门/期间/状态查询无需下载 Workbook；跨台账金额统计有明确类型/币种口径，审批读固定修订的服务端变量。
8. 提交时未确认编辑先处理；保存/校验/附件扫描失败阻止提交；重复提交不产生两个活动流程。
9. 批准单任务不被误认为流程完成；乱序、重复、超时和旧流程回调不错误改变当前台账；驳回/撤回按策略开放区域。
10. 独立工作区包含产品 Header、导航、Ledger Header、自有 Toolbar、网格和侧栏；全屏、隐藏恢复、审批/历史/查看模式不丢草稿或重建无关实例。
11. 正常可见文本/Logo/错误/帮助不暴露上游品牌；许可证和来源说明保留；图表等未本地化依赖不被默认请求。
12. 自有图标无需旧 class，CSS 和 Canvas 主题一致且不改变文档原格式；动态插件 UI、输入法和复杂格式按能力矩阵验收。
13. 安装包可从干净环境接入，真实多实例及生命周期满足父方案 M2/M3；文档中的 mock 通过不能替代真实引擎通过。
14. 每个发布能力有 unit/contract/browser 中相应证据，已知失败和未验证项公开；未达到门禁的高级功能不出现在可用按钮中。
15. 未完成必填项的草稿可以保存，保存状态与校验状态分别显示；非法金额不被变为 0 或沿用旧值，提交被拒绝且统计注明排除数量。
16. 提交与并发保存/第二次发起流程竞争时只有合法事务成功；从 starting 到 sync-error 均保持活动绑定和编辑锁，不依赖回调到达才锁定。
17. 保存时更改附件或继续输入不误报 clean；提交的版本与用户确认的屏幕内容一致；历史部门/期间/附件版本和审批变量不会随现值变化。
18. 本轮交付验收只检查三份文档的源码引用、协议一致性、任务依赖与非文档文件未变；上述产品功能验收均为后续实施门禁，本轮没有冒充已实现或已通过。

## 19. Risks：最大的五项风险

| 风险                            | 源码/设计依据                                                         | 控制措施与门禁                                                                      |
| ------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 全局 UI/状态与自有 Toolbar 接缝 | Store/配置/公式/保护对象共享，菜单/提示挂 body，旧 API 部分依赖原控件 | 基线、真实 bridge 测试、逐组迁移、资源作用域；没有 M2 不宣称多实例                  |
| Workbook 与业务身份/投影失配    | 自由结构编辑、排序、合并会改变坐标；完整快照与索引分存                | 固定定义、稳定 ID、受控结构计划、同 Revision 原子提交；未能校验则禁结构操作         |
| 权限表面有效但数据已泄漏        | 本地 authority/隐藏只限制交互，JSON/公式/附件/导出可旁路              | 服务端重鉴权与差异校验、无 VIEW 不下发、受限 ReadView 禁整包写；作为上线阻断项      |
| 保存和流程在失败/重试时分叉     | 对象存储/DB/引擎跨边界，迟到响应与重复回调                            | CAS、幂等、不可变提交修订、outbox/inbox、对账；引擎无幂等能力时谨慎阻断自动重试     |
| 保真、资源许可与工程可发布性    | 字体/sprite/Canvas 多视觉源，公式动态求值，打印缺件、入口与产物不符   | 兼容夹具、能力矩阵、CSP 标记、本地资源/许可清单和真实包验证；不把高级功能当现成组件 |

## 20. Open Questions 与实施默认值

| 问题                                               | 当前设计默认值                                              | 何时必须确认                                         |
| -------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| 首批台账是单据式、明细式还是自由文档？             | 固定字段 + 一个受控明细区 + 可选自由区，以费用 fixture 验证 | 真实业务定义发布前                                   |
| 首个业务框架/现有后端/数据库/组织目录？            | 契约与 Domain 框架无关；Shell 先 mock，不因本设计更换构建   | 建真实 Shell 和数据库迁移前                          |
| 产品名、Logo、主色、字体及品牌规范？               | 中性“台账平台”、浅色 token、自有语义 Icon                   | 视觉发布前，不用上游 Logo 临时代替                   |
| 工作流引擎、任务语义、验签/幂等/按业务键查询支持？ | Mock Adapter，真实能力全部 NEED VERIFY                      | 接真实引擎前                                         |
| 审批中是否允许改非审批区域？                       | 全文只读；需要时显式定义不影响审批变量的范围                | 启用局部审批编辑前                                   |
| 是否需要机密字段局部可见且可编辑？                 | 全文可见编辑者 + 裁剪只读查看者                             | 若需要受限编辑，先实施服务端 Patch，不能复用整包保存 |
| 金额/日期/公式哪些参与流程？                       | 受限类型字段和服务端业务规则，客户端公式缓存不作依据        | 定义规则/报表口径冻结前                              |
| 文件保留、审计留存、本机草稿及附件大小？           | 敏感本机缓存默认关闭；限额可配，不发明业务合规年限          | 真实数据上线前                                       |
| 浏览器、行列规模、并发、保存 SLA、离线需求？       | PC 单会话，采用父方案性能夹具建立基线；不承诺未测数字       | 试点验收前                                           |
| XLSX/打印具体保真范围、现有服务可否复用？          | 暂不开放未接通能力，先解析/转换报告                         | 文件插件立项前                                       |

上述问题不阻塞下一阶段的契约、fixture、依赖检查、保存/权限模型和 mock 工作区；涉及真实数据或外部引擎的任务只在必要资料明确后进入相应实现，不将猜测写成产品支持承诺。
