# 台账平台 Future Backlog

## 1. Purpose and Promotion Rules

本文件承接 [Master Roadmap](./next-stage-tasks.md) 中 Phase 1 以外的能力。它不改变已确认的 Ledger / Spreadsheet / Workflow 边界，也不授权开始实现这些工作。当前执行清单是 [Phase 1 Internal MVP](./phase-1-mvp-tasks.md)。

Master Roadmap 当前共有 98 个叶子任务：29 个任务的全部或收敛子集进入 Phase 1，69 个任务整体延期。进入 Phase 1 的 29 个任务中，长期部分仍在本文件明确保留；“进入 Phase 1”不表示把原任务的扩展范围提前实现。

任何 backlog 项只有同时满足以下条件才允许提升：

1. Phase 1 Acceptance 已全部通过，并完成 Demo、Review、Architecture Check 和 UX Check。
2. 有真实用户、业务规则、外部系统或测量数据证明需求，不以“未来可能需要”为理由。
3. 输入/输出、权限、数据版本、失败行为和回滚办法可说明，依赖已满足。
4. 能拆成独立测试、评审、提交和回退的叶子任务；未支持能力继续显式 disabled。
5. 提升后更新 Phase 计划和验收，不直接按 Master 中的大范围描述开工。

## 2. Phase 2：Ledger Beta

目标是在 Phase 1 的真实保存闭环上增加业务台账能力，而不是扩大 Spreadsheet 技术面。优先顺序应由首批真实台账反馈决定。

| Backlog                        | 对应原任务                              | Deferred Reason                                         | Promotion Condition                                                        |
| ------------------------------ | --------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| 定义版本管理和发布             | T03 剩余、T13                           | Phase 1 只有固定 fixture，无定义管理员                  | 至少第二种真实台账需要创建/发布定义；模板版本规则已确认                    |
| 字段、范围、Record、BindingMap | T03/T05/T15/T20 剩余、T17–T19、T37–T39c | 固定 Workbook 保存不需要稳定业务记录和结构变换          | 出现跨台账查询、受控明细增删/排序或字段级业务规则；先冻结最小 BindingMap   |
| Ledger 查询、历史与恢复        | T23、T24、T67                           | Phase 1 只开当前/指定 Revision，无列表统计和恢复        | 试点需要按部门/期间查找、查看版本列表或纠错恢复；授权与口径明确            |
| 自动保存与草稿校验             | T22 剩余、T66                           | Phase 1 只有手动保存；先验证 CAS 和 dirty 语义          | 手动保存闭环稳定，业务确认防抖、未完成草稿和失败提示要求                   |
| 简单权限扩展                   | T05/T15/T28/T68 剩余、T59               | Phase 1 只有 canView/canEdit/canSave，不做局部可见      | 至少一个真实角色无法由整份可见/只读表达；服务端保存与读取可统一执行策略    |
| Product Workspace 扩展         | T25/T26/T28 剩余                        | Phase 1 不需要 Navigation、Inspector、复杂查看/历史模式 | 真实信息架构和宿主框架确定，用户验证需要这些页面区域                       |
| Toolbar 常用能力               | T30–T36                                 | Phase 1 只需 Undo/Redo/Bold                             | 用户完成台账所需的具体格式/查找能力已排序；对应 SDK 命令、权限和历史可测试 |
| 受控结构操作                   | T37–T39c                                | 结构操作会破坏坐标与 Record 身份                        | BindingMap 和变换计划先通过纯函数测试；业务确需增删/排序                   |
| Attachment                     | T43a–T44b                               | 明确列为 Phase 1 Non Goal，且会引入文件安全和版本关系   | 业务必须上传文件；存储、扫描、权限、历史保留和 GC 策略已确认               |

Phase 2 仍不接真实 Workflow。若需要“提交”按钮但流程尚未进入 Phase 3，可先定义纯 Ledger 状态评审，但必须另行收敛，不能复用 Spreadsheet 批注冒充审批。

## 3. Phase 3：Workflow

目标是在稳定 Revision、权限和附件边界上接入可替换的 WorkflowAdapter。工作流只操作流程和 Ledger 状态；它不调用 Spreadsheet、Store 或 DOM。

| Backlog                          | 对应原任务               | Deferred Reason                                 | Promotion Condition                                                |
| -------------------------------- | ------------------------ | ----------------------------------------------- | ------------------------------------------------------------------ |
| Workflow contract 与 mock        | T45                      | Phase 1 没有流程使用者，占位代码没有产品价值    | 选定首个审批用例、提交 Revision 语义和状态转换后                   |
| Submission 与提交屏障            | T46、T69                 | Phase 1 仅保存，不存在待审批固定版本            | Ledger Beta 的校验、附件和 Revision 一致性完成；提交行为有明确需求 |
| Outbox、Worker 与对账            | T47                      | 分布式一致性超出 MVP，真实引擎能力未知          | 已选择真实引擎并核实幂等 start/业务键查询；故障演练方案可执行      |
| Callback、Inbox 与状态投影       | T48a、T48b               | 没有真实事件来源，不应预建基础设施              | 引擎 webhook/签名/顺序协议有正式资料和测试环境                     |
| 任务/历史 API 与 Workflow Panel  | T49a、T49b、T28 审批部分 | Phase 1 页面不含审批模式或 Workflow Panel       | 任务 DTO、版本固定、授权和产品交互已经评审                         |
| Approve/Reject/Withdraw/Transfer | T50a–T50d                | 动作语义依赖真实业务和引擎，不允许 fake success | 每个动作有权限、状态、幂等和失败验收；逐动作提升                   |
| 真实引擎适配                     | T51、T52a–T52d           | 当前仓库没有引擎、凭据或接口事实                | 引擎选择、测试环境、回调验签和每项 capability 完成核实             |

Phase 3 不以一次 HTTP 成功推断流程终态，不把 task comment 写入 Spreadsheet 批注，不因回调失败自动解锁 Workbook。

## 4. Phase 4：Advanced Spreadsheet

目标是按真实台账需求扩展 Spreadsheet UI 和文件能力。每项独立提升，不能一次启动“完整 Toolbar”。

| Backlog                     | 对应原任务                          | Deferred Reason                                    | Promotion Condition                                             |
| --------------------------- | ----------------------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| 数据验证产品化              | T40a                                | Phase 1 不需要规则编辑，业务校验仍属服务端         | 定义模型已有受限规则，SDK 能保存/撤销且服务端不会信任客户端规则 |
| 条件格式产品化              | T40b                                | 不影响首个保存闭环                                 | 真实台账需要视觉规则，stable ruleId 和快照往返已验证            |
| 图片和批注                  | T41a、T41b、T71a、T71b              | 牵涉资产授权、异步生命周期及评论身份               | Attachment/Asset 边界完成；每类操作有权限、历史和资源保留策略   |
| 全屏与 overlay              | T42                                 | Phase 1 普通 PC 工作区足够；全局 body 弹层仍高耦合 | 普通布局稳定，SDK overlay 所有权和焦点路由可测                  |
| 查找/替换错误体验           | T54d                                | Phase 1 无查找/替换 UI                             | T36 提升且消息 provider 已覆盖该路径                            |
| SDK 兼容皮肤和 Canvas Theme | T55、T56                            | Phase 1 只做产品 token 和最小兼容皮肤              | 有品牌视觉或主题需求的截图证据；不得改用户 Cell 格式            |
| XLSX import/apply           | T61、T62                            | 转换保真和恶意文件风险不服务 MVP                   | 真实文件样本、兼容矩阵、大小限制、映射确认和失败回滚已定义      |
| XLSX export                 | T63                                 | 旧实现向外部服务上传全 Workbook，不可直接复用      | 授权 Revision、转换服务、数据范围和保真告警已确认               |
| Print                       | T64                                 | 当前 `print.js` 为空，不能宣称有实现               | 完成专项能力报告、字体/分页/权限方案和固定 fixture              |
| Chart / Pivot Table         | FB4-01（Master 能力项，无独立叶子） | 图表插件默认 CDN 且强耦合；透视表仍在内核          | 明确首个报表用例；依赖本地化、许可、数据保留和卸载测试通过      |

完整 Toolbar 是这些能力与 Phase 2 常用命令逐项验收后的结果，不作为一个大任务提升。

## 5. Phase 5：Production Hardening

目标是将已验证的内部产品变成可维护、可发布的系统。Phase 5 仍按证据逐项实施，不等于一次性完成所有企业能力。

| Backlog                           | 对应原任务              | Deferred Reason                                          | Promotion Condition                                                      |
| --------------------------------- | ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| Object Storage SnapshotRepository | T12b、T16               | 当前没有大 Snapshot 证据，数据库方案更短且可事务保存     | 记录真实 p95/上限、数据库成本或行大小问题；Repository 替换测试已就绪     |
| 完整幂等与上传完整性              | T21、T16                | Phase 1 手动单请求 + CAS 已阻止静默覆盖                  | 自动重试、移动网络或大对象上传成为真实需求；幂等键生命周期明确           |
| Crash Recovery / Offline          | T60                     | 明确 Non Goal，涉及本地敏感数据与冲突                    | 有恢复需求和数据分级策略；跨用户清理、配额和冲突设计通过评审             |
| ChangeSet / Incremental Save      | T70a、T70b、T09 剩余    | 完整 Snapshot 足够；旧事件不是可靠操作日志               | 测得 Snapshot 保存瓶颈；命令覆盖、规范 hash 和重放验证成立               |
| 依赖、资源和许可证                | T57                     | Internal MVP 可先限制发行范围，但不得删除现有声明        | 准备外部分发或启用对应第三方资产前；未知必要资产必须解决                 |
| 包入口与产品资源白名单            | T58a、T58b              | Phase 1 不更换构建或发布 npm SDK                         | 准备可安装 SDK/独立产品包，依赖清单和兼容入口明确                        |
| 离线/子路径网络验证               | T58c 剩余               | Phase 1 只验证 MVP 无默认外网                            | 形成部署矩阵并需要离线/子路径交付                                        |
| Production release gate           | T65 剩余                | Phase 1 gate 不含完整多实例、性能、流程乱序和生产合规    | 实际发布范围冻结，所有启用 capability 都有测试和合规证据                 |
| 真正多实例与资源隔离              | FB5-01（父 SDK M2/M3）  | Phase 1 明确为单实例实验入口                             | 产品确需同页多实例；全局 Store、DOM、事件、语言和插件已按父方案迁移      |
| CSP 与动态求值治理                | FB5-02（父 SDK §7.4）   | 公式与数据解析均有 `new Function()`，不能在 MVP 机械替换 | 目标 CSP 明确，远程数据路径先封闭，公式结果回归夹具完整                  |
| 性能、可观测性和容量              | FB5-03（父 SDK §7.3）   | 当前无真实环境/数据规模，不应承诺数字                    | 固定设备、浏览器、数据量和 SLA；指标不记录 Workbook 敏感正文             |
| Collaboration / Mobile Editing    | FB5-04（Master 能力项） | 明确不属于 Phase 1，且各自需要专项协议/UI                | 分别立项并有真实需求；协同不得仅广播命令，移动端不得由响应式截图代替验收 |

## 6. Original Task Mapping

以下表按 Master Roadmap 的 98 个叶子任务逐项映射。`Phase 1（收敛）` 表示只实施 [Phase 1 任务](./phase-1-mvp-tasks.md) 定义的子集；原任务超出的部分仍由“残余去向”保留。其他项整体延期。

| 原任务 | 新阶段          | 处理/残余去向                                                                       |
| ------ | --------------- | ----------------------------------------------------------------------------------- |
| T01    | Phase 1         | P1-01，完整吸收最小引擎 fixture                                                     |
| T02    | Phase 1         | P1-02，完整吸收 MVP facade/fake/unsupported                                         |
| T03    | Phase 1（收敛） | P1-03 仅四模型和固定 fixture；Field/Range/Manifest 进入 Phase 2                     |
| T04    | Phase 1         | P1-04，完整吸收依赖边界检查                                                         |
| T05    | Phase 1（收敛） | P1-03/P1-13 仅 canView/edit/save/create；复杂合并与范围权限进入 Phase 2             |
| T06    | Phase 1         | P1-05，保留实验性单实例限制                                                         |
| T07    | Phase 1         | P1-06，完整吸收 MVP Snapshot codec                                                  |
| T08    | Phase 1         | P1-07，仅查询 Phase 1 所需状态；其他格式随 Toolbar 提升                             |
| T09    | Phase 1（收敛） | P1-08 只做 committed change/dirty；clientEditSeq/ChangeSet 进入 Phase 5             |
| T10    | Phase 1         | P1-09，完整吸收单 Cell 命令和 readonly 门禁                                         |
| T11a   | Phase 1         | P1-10，吸收 undo/redo                                                               |
| T11b   | Phase 1         | P1-10，吸收单范围 bold                                                              |
| T12a   | Phase 1（收敛） | P1-13 先确认现有后端/DB，只建最小 DB Repository；扩展适配进入 Phase 2/5             |
| T12b   | Phase 5         | Object Storage 无体积证据，延期                                                     |
| T13    | Phase 2         | Phase 1 使用固定 seed，不建定义发布 API                                             |
| T14    | Phase 1（收敛） | P1-13 创建/读取实例和初始 Revision，不含复杂租户/模板管理                           |
| T15    | Phase 1（收敛） | P1-13/P1-14 只返回 canView/edit/save；细粒度策略进入 Phase 2                        |
| T16    | Phase 5         | candidate upload/Object Storage 延期                                                |
| T17    | Phase 2         | Phase 1 后端把 Snapshot 当不透明、受 schema 限制的 JSON；字段 CellView 延期         |
| T18    | Phase 2         | 全快照差异授权依赖细粒度 ACL；Phase 1 只允许整份编辑者并做 CAS/大小/schema 校验     |
| T19    | Phase 2         | 字段抽取和业务合计不服务固定表格保存闭环                                            |
| T20    | Phase 1（收敛） | P1-13 仅 Revision+head CAS；BindingMap/投影/审计进入 Phase 2                        |
| T21    | Phase 5         | 复杂 HTTP 幂等延期；Phase 1 网络不确定时先重新读取 head                             |
| T22    | Phase 1（收敛） | P1-14 只有手动保存状态；自动保存/offline/序号确认进入 Phase 2/5                     |
| T23    | Phase 2         | 修订列表、diff、restore 超出“查看指定 Revision”                                     |
| T24    | Phase 2         | 查询统计需要字段投影和真实口径                                                      |
| T25    | Phase 1（收敛） | P1-11 只做 Header/Ledger Header/Toolbar/Area；Navigation/Inspector 进入 Phase 2     |
| T26    | Phase 1（收敛） | P1-12 只做最小 tokens 和四图标；完整 Icon 层随 UI 扩展进入 Phase 2                  |
| T27    | Phase 1         | P1-14，真实 SDK 生命周期和手动保存集成                                              |
| T28    | Phase 1（收敛） | P1-14 只做 readonly/capability 和当前 Revision；查看/历史进 Phase 2，审批进 Phase 3 |
| T29    | Phase 1         | P1-11/P1-14，只接 undo/redo/bold，符合原任务范围                                    |
| T30    | Phase 2         | Phase 1 只在 P1-10 做 bold 必需的最小接缝；通用格式事务延期                         |
| T31    | Phase 2         | 完整字体样式 Action 组延期                                                          |
| T32    | Phase 2         | 颜色/对齐/数字格式延期                                                              |
| T33    | Phase 2         | 边框延期                                                                            |
| T34    | Phase 2         | 合并/取消合并延期                                                                   |
| T35a   | Phase 2         | 冻结 Action 延期                                                                    |
| T35b   | Phase 2         | 筛选开关延期                                                                        |
| T35c   | Phase 2         | 筛选条件延期                                                                        |
| T36    | Phase 2         | 查找/替换延期                                                                       |
| T37    | Phase 2         | BindingMap 结构变换延期                                                             |
| T38    | Phase 2         | 受控新增 Record 延期                                                                |
| T39a   | Phase 2         | 受控删除 Record 延期                                                                |
| T39b   | Phase 2         | Record 排序延期                                                                     |
| T39c   | Phase 2         | 自由区列操作影响校验延期                                                            |
| T40a   | Phase 4         | 数据验证产品化延期                                                                  |
| T40b   | Phase 4         | 条件格式产品化延期                                                                  |
| T41a   | Phase 4         | 图片插入依赖授权资产边界                                                            |
| T41b   | Phase 4         | 批注产品化延期，不冒充 Workflow 意见                                                |
| T42    | Phase 4         | 全屏/overlay 深层接缝延期                                                           |
| T43a   | Phase 2         | 附件上传系统延期                                                                    |
| T43b   | Phase 2         | 附件扫描状态延期                                                                    |
| T43c   | Phase 2         | 附件授权下载延期                                                                    |
| T44a   | Phase 2         | 附件进入 Revision Manifest 延期                                                     |
| T44b   | Phase 2         | Attachment Panel 延期                                                               |
| T45    | Phase 3         | 无 Workflow 使用者，不写占位生产实现                                                |
| T46    | Phase 3         | Submission 和流程固定 Revision 延期                                                 |
| T47    | Phase 3         | Outbox/Worker/对账延期                                                              |
| T48a   | Phase 3         | webhook 签名与 inbox 延期                                                           |
| T48b   | Phase 3         | 流程事件投影和状态策略延期                                                          |
| T49a   | Phase 3         | 任务/历史 API 延期                                                                  |
| T49b   | Phase 3         | Workflow Panel 延期                                                                 |
| T50a   | Phase 3         | Approve 延期                                                                        |
| T50b   | Phase 3         | Reject 延期                                                                         |
| T50c   | Phase 3         | Withdraw 延期                                                                       |
| T50d   | Phase 3         | Transfer 延期                                                                       |
| T51    | Phase 3         | 真实引擎选择和测试环境尚不存在                                                      |
| T52a   | Phase 3         | 真实 approve 映射延期                                                               |
| T52b   | Phase 3         | 真实 reject 映射延期                                                                |
| T52c   | Phase 3         | 真实 withdraw 映射延期                                                              |
| T52d   | Phase 3         | 真实 transfer 映射延期                                                              |
| T53a   | Phase 1         | P1-12，关闭原信息栏、插件和旧网络                                                   |
| T53b   | Phase 1（收敛） | P1-12 覆盖 MVP 可见名称/帮助；全量语言与非 MVP 路径随对应能力提升                   |
| T54a   | Phase 1（收敛） | P1-12 建 MVP message/error 接缝；全路径覆盖随能力提升                               |
| T54b   | Phase 1         | P1-12 覆盖创建/资源加载错误                                                         |
| T54c   | Phase 1         | P1-09/P1-12 覆盖单 Cell 编辑错误                                                    |
| T54d   | Phase 4         | 查找/替换未进入 Phase 1                                                             |
| T55    | Phase 4         | Phase 1 只有产品 token/最小兼容皮肤，深层 SDK 皮肤延期                              |
| T56    | Phase 4         | Canvas Theme 延期                                                                   |
| T57    | Phase 5         | 外部分发前完成完整资源/许可证清单；Phase 1 保留现有 LICENSE                         |
| T58a   | Phase 5         | 包入口修正属于正式 SDK 发布，不为 MVP 更换构建路径                                  |
| T58b   | Phase 5         | 产品发行资源白名单延期；Phase 1 通过入口 preset 隔离 demo                           |
| T58c   | Phase 1（收敛） | P1-12/P1-15 只验证 MVP 无默认外网；离线/子路径部署进 Phase 5                        |
| T59    | Phase 2         | 敏感字段 ReadView 明确不做                                                          |
| T60    | Phase 5         | Crash Recovery/本地缓存明确不做                                                     |
| T61    | Phase 4         | XLSX 解析预览延期                                                                   |
| T62    | Phase 4         | XLSX 应用延期                                                                       |
| T63    | Phase 4         | XLSX 导出延期                                                                       |
| T64    | Phase 4         | Print 延期，当前实现为空                                                            |
| T65    | Phase 1（收敛） | P1-15 只建 Internal MVP gate；正式发布、多实例、性能和合规 gate 进 Phase 5          |
| T66    | Phase 2         | 复杂草稿校验/投影状态延期；Phase 1 只校验 Snapshot schema/大小                      |
| T67    | Phase 2         | 元数据历史事务延期；Phase 1 department/period 创建后不提供编辑入口                  |
| T68    | Phase 2         | Policy 队列屏障延期；Phase 1 启动时以整实例 readonly/capability 固定授权            |
| T69    | Phase 3         | 附件/提交联合屏障依赖 Phase 2 与 Workflow                                           |
| T70a   | Phase 5         | ChangeSet 契约延期                                                                  |
| T70b   | Phase 5         | 增量重放/checkpoint 延期                                                            |
| T71a   | Phase 4         | 图片 geometry/anchor 更新延期                                                       |
| T71b   | Phase 4         | 图片删除/历史资源保留延期                                                           |

## 7. Backlog Stop Rule

Backlog 不是默认排期。Phase 1 完成后先基于 Internal Demo 证据选择 Phase 2 的最小目标；没有晋级条件的项目继续保持 unavailable。Phase 2、3、4、5 可以因业务优先级交错，但依赖不能倒置：例如 XLSX 导出不能绕过权限和 Revision，Workflow 不能在保存闭环之前启动，Object Storage 不能在 Repository 抽象之外泄漏给 Ledger 用例。
