# Luckysheet UI、品牌与资源源码审计

## 1. 范围、方法和结论状态

本审计服务于 [台账平台设计](./ledger-platform-design.md)，延续 [Spreadsheet SDK 改造方案](./embeddable-spreadsheet-sdk-plan.md)。本轮仅输出文档，不修改运行代码、构建配置或第三方资源。

已遍历 `src`、`integration`，扫描源码、模板、CSS、语言包、图标描述和资源路径，并读取创建、工具栏、菜单、提示、加载、API、保护、保存、插件及构建关键路径。自动文本扫描涵盖第三方压缩文件和 source map；第三方压缩实现、所有公式算法没有逐行语义复审。`docs/.vuepress`、根许可证、包声明及工作流配置另作发布边界检查。`node_modules`、`.git` 和生成的 `dist` 不作为原创实现依据。

这是完整模块/资源清点及静态源码审计，**不是所有动态界面的运行验收报告**。本文的“已确认”表示有源码证据；某项在当前构建中是否能走通、字体实际渲染、快捷键旁路、第三方 UI 动态插入和截图效果统一标为 **NEED VERIFY**，不得据此声称已去品牌化。行号是本次源码定位，后续应同时按符号名搜索。

复核时间 2026-09-13，HEAD `e7b76a8`。完整文件树扫描覆盖 `src/integration` 的 185 个文件，其中 154 个可解码文本共 214,846 行（含 demo、minified bundle、map 和 SVG）；引擎控制器 46 个、global 模块 31 个均纳入 UI/网络/动态求值/日志/Canvas 扫描。完整读取 SDK 方案，并重点阅读创建 → 模板/布局 → 输入/格式 API→ 历史/事件 → 快照 → 销毁及插件的真实调用链。没有把全部公式算法和第三方压缩实现逐行语义评审，未启动浏览器或运行构建，不能将本报告描述为完整功能测试。

复核使用 `rg --files --hidden` 与 `git ls-files`、实际目录遍历交叉检查：`.gitignore` 中的打印文件规则会让普通 `rg --files` 漏掉受跟踪的空 `print.js`。本轮据此修正原草稿“文件不存在”的表述；文件存在不等于功能实现。

分类按目标职责，组合类别表示分阶段处理：

| 分类 | 含义                                     | 处理原则                                          |
| ---- | ---------------------------------------- | ------------------------------------------------- |
| A    | 必须保留的 Spreadsheet 核心 UI/交互      | 保留能力，由 SDK 封装和主题化                     |
| B    | 可通过现有配置隐藏的 UI                  | 通过 SDK 配置映射，不由业务操作内部 DOM           |
| C    | 宿主需要重新实现的产品 UI                | Application/ Ledger/Workflow 各自拥有，不写进引擎 |
| D    | 应从正常用户界面移除的上游品牌           | 移除视觉和默认文案，保留许可及来源记录            |
| E    | 当前耦合较深，暂时保留或不开放的 UI/资源 | 明确能力门禁、替换任务及验证项                    |

## 2. 关键问题索引

| 编号 | 已确认事实                                                                                            | 对产品化的影响                                                                   |
| ---- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| F01  | `core.create()` 首先全局销毁；Store、配置、公式、网络、保护缓存均有共享状态                           | 产品只能先做单实例实验入口，不能用双容器宣称多实例                               |
| F02  | `createdom()` 向 `body` 追加菜单、输入层和遮罩；tooltip/插件也自行挂载                                | 隐藏工具栏不能完成 UI 隔离，全屏/侧栏/主题需要 SDK 承接                          |
| F03  | `showtoolbar=false` 在对象配置模式下仍可能被单项 `true` 覆盖                                          | SDK 必须生成明确配置并用页面测试验证隐藏结果                                     |
| F04  | 标题栏、CSS 内嵌 Logo、函数类别、示例网址、文档站均有品牌痕迹                                         | 去品牌不止换 Logo；要覆盖异常、帮助和发布资源                                    |
| F05  | 默认插件表只注册 `chart`；demo 同时请求 `exportXlsx` 和 `print`                                       | 有文件不代表能力可用；未知插件会进入未定义函数调用                               |
| F06  | 打印入口导入 `./print`，`print.js` 是受 Git 跟踪的 0 字节文件、没有导出实现，构建还排除打印静态目录   | 打印不能承诺现成可用；明确缺件，后续专项接入                                     |
| F07  | 导出插件调用全局 `luckysheet.toJson()` 并将整个工作簿 POST 到配置地址                                 | 不能直接用作受权限约束的台账导出服务                                             |
| F08  | API 中存在固定英文错误、`alert()`、控制器调用、坐标日志、非统一刷新                                   | 自定义 Toolbar 需要语义适配和测试，不是方法改名                                  |
| F09  | `config.authority`、`lo/hi` 是本地工作表保护，没有服务端业务授权                                      | 隐藏/只读不能代替机密数据裁剪和服务端鉴权                                        |
| F10  | 默认构建是命名为 `.umd.js` 的 IIFE；声明的 ESM/CJS 未由默认任务生成                                   | 接入必须验证实际安装包，保持已有计划中的构建修复项                               |
| F11  | CSS、Canvas、iconfont、Font Awesome、sprite、第三方控件各有视觉源                                     | 单纯改 CSS Variables 或换一套字体无法统一全部 UI                                 |
| F12  | 数据解析和公式计算均有 `new Function()`；另有数据 URL Worker                                          | JSON 协议修复与严格 CSP 兼容是不同工作，不能用全局替换处理                       |
| F13  | `getCellValue(type='v')` 会对 `yyyy-MM-dd` 返回显示文本；`toJson()` 读取标题 DOM 并复用初始化选项对象 | 业务抽取需标准 CellView；快照需要独立 codec，不能以旧 getter/toJson 作为权威契约 |
| F14  | `setRangeFormat()` 末尾 success 分支为空，修改后才保存用于错误恢复的副本                              | 直接 Promise 包装可能不结束；多范围格式需要真正的事务前快照和原子提交            |
| F15  | Sheet/Status 配置也使用对象覆盖，隐藏逻辑没有对称地恢复各子项；状态初始化 flag 与创建/销毁路径需核对  | 不能声称当前配置已支持可靠动态切换；UI preset 和再次创建都须测试                 |
| F16  | `listener` 代理旧历史数组驱动按钮/updated；customFunctions 挂 `window.luckysheet_function`            | `updated` 不是可靠业务 ChangeSet；自定义公式及状态查询仍有全局依赖               |

## 3. 交互 UI 完整模块清单

“配置”列中的名称均为旧引擎内部映射参考，不是上层 Ledger API。新业务组件不得直接使用这些选择器、模块或旧配置结构。

| UI/能力                               | 源码位置与定位                                                                                                                                                                | 分类  | 当前控制方式与建议                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| 应用名称/返回/保存提示/用户入口       | [constant.js](../src/controllers/constant.js#L7) `gridHTML`；[handler.js](../src/controllers/handler.js#L5751) 返回跳转                                                       | B/C/D | `showinfobar`；整个业务头部由 Ledger Header 接管，原“等待/更新”不作为保存成功证据              |
| 原工具栏分组、按钮、分隔和图标        | [toolbar.js](../src/controllers/toolbar.js#L7) `defaultToolbar`、`toolbarIdMap`、`createToolbarHtml`                                                                          | B/C   | `showtoolbar/showtoolbarConfig`；自有 Toolbar 通过 SDK Action/Command 替换                     |
| 工具栏自适应/更多按钮                 | [resize.js](../src/controllers/resize.js#L325)；[iconCustom.css](../src/css/iconCustom.css#L19)                                                                               | B/E   | 原尺寸算法依赖内部 ID；新 Toolbar 自己负责溢出，不复用其 DOM                                   |
| 原格式菜单状态和按钮处理              | [menuButton.js](../src/controllers/menuButton.js#L1) `menuButtonFocus` 等                                                                                                     | E     | 既操作数据又更新按钮样式；拆出公开状态查询，不能读按钮 class 判定粗体                          |
| 名称框/公式输入栏/确认取消/fx         | [constant.js](../src/controllers/constant.js#L59)；[formulaBar.js](../src/controllers/formulaBar.js#L20)                                                                      | A/B/E | `sheetFormulaBar`；先保留 SDK 内公式编辑器并主题化，避免第一轮重写输入法及引用选择             |
| 网格、行列标题、滚动条、选区/填充柄   | [constant.js](../src/controllers/constant.js#L89)；[draw.js](../src/global/draw.js#L1)；[select.js](../src/controllers/select.js)                                             | A     | 保留，外部只使用查询与事件；Canvas 与 DOM 主题一起治理                                         |
| 行列尺寸拖动/行列菜单                 | [rowColumnOperation.js](../src/controllers/rowColumnOperation.js)；[handler.js](../src/controllers/handler.js)                                                                | A/B/E | 部分右键项可配；结构编辑须经过台账绑定与权限校验                                               |
| 单元格右键主菜单/子菜单               | [constant.js](../src/controllers/constant.js#L346) `rightclickHTML`、L1454 `customCellRightClickConfig`；[rowColumnOperation.js](../src/controllers/rowColumnOperation.js)    | A/B/E | `cellRightClickConfig`；所有已知项逐项控制，隐藏不阻止快捷键/API                               |
| 自定义右键项                          | [constant.js](../src/controllers/constant.js#L379) `config.customs`                                                                                                           | C/E   | 标题字符串插入 HTML；目标改为类型化 action，业务不用原事件参数和 DOM                           |
| Sheet Tab、加表、列表、左右滚动       | [constant.js](../src/controllers/constant.js#L235)；[sheetBar.js](../src/controllers/sheetBar.js#L190)                                                                        | A/B   | `showsheetbar/showsheetbarConfig`；保留表内导航，业务的“台账列表”属于外层                      |
| Sheet 重命名/复制/删除/颜色/隐藏/移动 | [constant.js](../src/controllers/constant.js#L928) `sheetconfigHTML`、L1491 配置；[sheetBar.js](../src/controllers/sheetBar.js#L250)                                          | A/B/E | `sheetRightClickConfig`；正式台账默认限制模板结构修改，隐藏 Sheet 不是访问控制                 |
| 选区求和/计数等状态栏                 | [constant.js](../src/controllers/constant.js#L258)；[count.js](../src/global/count.js)；[resize.js](../src/controllers/resize.js#L548)                                        | A/B   | `showstatisticBarConfig.count`；只表示选区统计，不表示业务校验/云端保存                        |
| 缩放/打印视图入口                     | [zoom.js](../src/controllers/zoom.js)；[luckysheet-zoom.css](../src/css/luckysheet-zoom.css)；[resize.js](../src/controllers/resize.js#L558)                                  | A/B/E | `view/zoom`；目标由 SDK view 命令驱动，打印视图入口可用性 NEED VERIFY                          |
| 通用提示/确认弹窗和遮罩               | [tooltip.js](../src/global/tooltip.js#L7) `info/confirm`；[constant.js](../src/controllers/constant.js) `modelHTML/maskHTML`                                                  | C/E   | 没有完整宿主 dialog provider；需小范围注入 SDK UI 服务，不能全局劫持 `window.alert`            |
| Hover Tooltip/Popover                 | [tooltip.js](../src/global/tooltip.js#L174) `createHoverTip`、`popover`                                                                                                       | A/E   | `body` 挂载、计时器、HTML 内容；迁入 overlayRoot 和资源管理器                                  |
| 初始化 Loading                        | [constant.js](../src/controllers/constant.js#L1200) `customLoadingConfig/luckysheetlodingHTML`                                                                                | B/C   | `loading.enable/image/text/...` 可配置；基础 spinner 已是 SVG，不能误写为默认一定显示品牌 Logo |
| 单元格加载提示                        | [loading.js](../src/global/loading.js#L1)；[constant.js](../src/controllers/constant.js#L135)                                                                                 | A/E   | 另一套固定 ID 加载层，主 loading 配置不能证明覆盖它                                            |
| 浏览器原生 alert/固定英文错误         | [searchReplace.js](../src/controllers/searchReplace.js#L262)、[sheetBar.js](../src/controllers/sheetBar.js#L132)、[api.js](../src/global/api.js#L115)                         | C/E   | 逐模块映射 error code/message catalog；用户提示不显示内部函数名/原始异常                       |
| 富文本输入/IME/粘贴层                 | [constant.js](../src/controllers/constant.js) `inputHTML`；[formula.js](../src/global/formula.js)；[keyboard.js](../src/controllers/keyboard.js)                              | A/E   | 不是可以随便删掉的隐藏 DOM；保留输入语义及剪贴板回归                                           |
| 公式自动补全/帮助/函数选择/引用高亮   | [formula.js](../src/global/formula.js)；[insertFormula.js](../src/controllers/insertFormula.js)；[functionListDescriptor.js](../src/function/functionListDescriptor.js)       | A/D/E | 保留公式帮助，替换品牌分类及示例地址；与名称为 help 的普通公式辅助层区别处理                   |
| IF 公式生成器                         | [ifFormulaGenerator.js](../src/controllers/ifFormulaGenerator.js)                                                                                                             | A/E   | 复杂弹窗先封装，作为扩展能力控制                                                               |
| 数字/日期/货币/更多格式面板           | [moreFormat.js](../src/controllers/moreFormat.js)、[cellFormat.js](../src/controllers/cellFormat.js)、[luckysheet-cellFormat.css](../src/css/luckysheet-cellFormat.css)       | A/E   | 自有面板逐步调用 `sheet.set-format`，格式规则留在 SDK                                          |
| 颜色和 Sheet 颜色选择器               | [menuButton.js](../src/controllers/menuButton.js)、[sheetBar.js](../src/controllers/sheetBar.js#L26)、[spectrum.min.js](../src/plugins/js/spectrum.min.js)                    | B/E   | Spectrum 默认 `appendTo: body`；需要显式挂载与主题，不能只去掉旧工具栏                         |
| 日期单元格 Picker                     | [cellDatePickerCtrl.js](../src/controllers/cellDatePickerCtrl.js#L30)、[core.js](../src/core.js) `flatpickr.localize`                                                         | A/E   | 固定 `#luckysheet-input-box`、全局语言；每实例日期/语言配置，避免与宿主日期组件混用            |
| 筛选箭头/条件/值列表/子菜单           | [filter.js](../src/controllers/filter.js)、[constant.js](../src/controllers/constant.js#L1073)                                                                                | A/E   | 禁用工具栏筛选不移除已有筛选控件；受权限与行绑定规则约束                                       |
| 排序及多级排序对话框                  | [orderBy.js](../src/controllers/orderBy.js)、[api.js](../src/global/api.js#L3460)                                                                                             | A/E   | 排序必须同步业务 Record 身份，禁止只排序绑定区域的部分列                                       |
| 冻结边界/拖动/提示                    | [freezen.js](../src/controllers/freezen.js)、[api.js](../src/global/api.js#L632)                                                                                              | A/E   | 固定定位与 Canvas 关联；保留结构，主题化后验收                                                 |
| 查找替换                              | [searchReplace.js](../src/controllers/searchReplace.js)、[api.js](../src/global/api.js#L6947)                                                                                 | A/B/E | 旧 `openSearchDialog` 仍是内部弹窗；新 find UI 用查询 API，replace 为写命令                    |
| 条件格式/色阶/数据条/图标集           | [conditionformat.js](../src/controllers/conditionformat.js)、[alternateformat.js](../src/controllers/alternateformat.js)、[constant.js](../src/controllers/constant.js#L1410) | A/E   | 图标集是文档视觉语义，不是品牌图标；不能直接换成通用 UI icon                                   |
| 数据验证/下拉/提示和错误框            | [dataVerificationCtrl.js](../src/controllers/dataVerificationCtrl.js)、[constant.js](../src/controllers/constant.js#L224)                                                     | A/E   | 字段约束由 Domain 定义，SDK 仅辅助输入；服务端再次校验                                         |
| 批注框/编辑/作者显示                  | [postil.js](../src/controllers/postil.js#L426)                                                                                                                                | A/E   | 保存于单元格 `ps`，不等于审批意见或 AuditLog；作者身份不可相信客户端文本                       |
| 插入图片/拖动/裁剪/预览               | [imageCtrl.js](../src/controllers/imageCtrl.js#L54)、[imageUpdateCtrl.js](../src/controllers/imageUpdateCtrl.js)、[api.js](../src/global/api.js#L6393)                        | A/E   | 工作簿图片与业务 Attachment 分开；目标使用宿主授权的资源引用                                   |
| 超链接编辑/打开/提示                  | [hyperlinkCtrl.js](../src/controllers/hyperlinkCtrl.js#L100)                                                                                                                  | A/E   | L239 `window.open(item.linkAddress)`；需协议/域策略，外链不是业务路由                          |
| 分列/矩阵计算/下拉填充                | [splitColumn.js](../src/controllers/splitColumn.js)、[matrixOperation.js](../src/controllers/matrixOperation.js)、[dropCell.js](../src/controllers/dropCell.js)               | A/B/E | 涉及批量修改，先通过 SDK 事务与字段绑定检查再开放                                              |
| 保护工作表/范围密码侧栏               | [protection.js](../src/controllers/protection.js#L17)、[luckysheet-protection.css](../src/css/luckysheet-protection.css)                                                      | B/C/E | 产品移除“用工作表密码管理业务权限”的入口；SDK 只消费计算后的策略                               |
| 图表右侧配置/拖动/缩放                | [chart/plugin.js](../src/expendPlugins/chart/plugin.js#L25)、[chartmix.css](../src/expendPlugins/chart/chartmix.css)                                                          | B/E   | 自带 Vue2/Vuex/Element UI 和 CDN，挂载 body；先关闭，后独立迁移                                |
| 透视表配置/过滤/字段拖动              | [pivotTable.js](../src/controllers/pivotTable.js#L1023)、[constant.js](../src/controllers/constant.js#L853)                                                                   | B/E   | 内核控制器直接实现，尚未独立插件；产品报表不直接依赖此 UI                                      |
| XLSX 导出选择范围对话框               | [exportXlsx/plugin.js](../src/expendPlugins/exportXlsx/plugin.js#L65)                                                                                                         | C/E   | 宿主导出任务负责权限、文件名和任务状态；插件只承担格式转换                                     |
| 打印配置/视图                         | [print/plugin.js](../src/expendPlugins/print/plugin.js#L1)、[print.css](../src/expendPlugins/print/print.css)                                                                 | C/E   | `./print.js` 为空文件，没有 `luckysheetPrint` 导出，当前不开放；主题、分页和许可单独验收       |
| 截图/复制图片/下载对话框              | [tooltip.js](../src/global/tooltip.js#L70)、[api.js](../src/global/api.js#L5701)                                                                                              | B/E   | 有导出数据的效果，必须纳入 EXPORT/COPY 策略，不能作为绕过路径                                  |
| 底部加行/回顶部/分页                  | [createdom.js](../src/global/createdom.js#L65)                                                                                                                                | B/C/E | `enableAddRow/enableAddBackTop/enablePage`；台账列表分页不交给此控件；“下一页”有硬编码中文     |
| 协同选区/用户高亮/网络状态            | [server.js](../src/controllers/server.js)、[select.js](../src/controllers/select.js)                                                                                          | E     | 与工作流无关；本阶段不开放旧协同网络连接                                                       |
| 移动端交互                            | [mobile.js](../src/controllers/mobile.js)                                                                                                                                     | E     | PC 优先；存在源码不构成移动端编辑支持承诺                                                      |

补充的交互/布局支撑模块也已纳入扫描：`handler`、`listener`、`selection`、`sheetMove`、`sheetSearch`、`locationCell`、`updateCell`、`controlHistory`、`inlineString`、`sparkline`；以及 `global/refresh`、`scroll`、`rhchInit`、`location`、`border`、`format`、`getRowlen`、`cursorPos`、`editor`、`createsheet`、`cleargridelement`。它们不是独立业务面板，但会决定外部 Toolbar、焦点、主题、保存和范围权限是否可靠。

## 4. 品牌与用户文案清单

| 痕迹                                       | 源码/资源定位                                                                                                                                                                           | 分类  | 改造建议和验证                                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| 浏览器标题 `Luckysheet`                    | [src/index.html](../src/index.html#L9)                                                                                                                                                  | D     | 产品新入口设置“台账名 · 产品名”；未发现 SDK 主入口必须改写 `document.title`，不把 demo 行为归因于内核 |
| 默认工作簿名 `Luckysheet Demo`             | [config.js](../src/config.js#L19)                                                                                                                                                       | D     | SDK neutral 默认名，Ledger 显式提供名称；保存文件名也同步                                             |
| 顶部 Logo 节点                             | [constant.js](../src/controllers/constant.js#L25) `.luckysheet-share-logo`                                                                                                              | B/D   | 通过关闭 infobar 移除正常展示；不必删除保留给旧入口的源码                                             |
| CSS 内嵌 PNG Logo                          | [luckysheet-core.css](../src/css/luckysheet-core.css#L195)                                                                                                                              | D     | 单独检查最终产品 CSS；仅隐藏节点还会留下资源，资源移除排在后续裁剪                                    |
| iconfont `logo/logo2` 字形                 | [iconfont.css](../src/assets/iconfont/iconfont.css#L116)、[iconfont.json](../src/assets/iconfont/iconfont.json)                                                                         | D/E   | 当前未在主 UI 模板找到同名字形使用；不得将“字形存在”等同“默认展示”，从新 Icon Layer 禁用              |
| 默认用户 `Lucky`、出租车图标               | [constant.js](../src/controllers/constant.js#L11)；[config.js](../src/config.js#L20)                                                                                                    | B/C/D | 账户头像/名称只由 Application Shell 提供                                                              |
| 返回地址、用户菜单默认百度地址             | [config.js](../src/config.js#L21)、[handler.js](../src/controllers/handler.js#L5751)                                                                                                    | B/C   | 产品导航使用宿主 Router；不再提供 HTML 用户菜单                                                       |
| 函数来源分类中的 `Luckysheet`              | [zh.js](../src/locale/zh.js#L7093)、[en.js](../src/locale/en.js#L7110)、[es.js](../src/locale/es.js#L6781)、[zh_tw.js](../src/locale/zh_tw.js#L6807)                                    | D     | 映射为“内置函数”，四语言一起检查；保留函数内容                                                        |
| 函数帮助中的上游网址示例                   | [functionListDescriptor.js](../src/function/functionListDescriptor.js#L3407)                                                                                                            | D     | 改为中性示例地址；仅字符串出现不代表浏览器会自动请求                                                  |
| Demo 聊天/功能说明/社区链接                | [demoFeature.js](../src/demoData/demoFeature.js#L18)、[chat.js](../src/demoData/chat.js)、[src/index.html](../src/index.html)                                                           | C/D   | 不进入产品发布物，帮助由宿主提供；聊天不是产品 Workflow/协作模块                                      |
| 文档站 title/logo/favicon/About/赞助/社区  | [docs 配置](./.vuepress/config.js#L1)、[文档图片目录](./.vuepress/public/img)、[favicon](./.vuepress/public/favicon.ico)                                                                | C/D   | 属于原文档站，不自动嵌入网格；产品帮助重新编排，原开发者来源文档可保留                                |
| 原始中文、英文错误和提示                   | `tooltip.js`、`searchReplace.js`、`sheetBar.js`、`api.js`、四语言包                                                                                                                     | C/E   | 完整错误目录逐步替换；不向用户输出 Store、controller 或旧 API 名称                                    |
| Console 及工作簿日志                       | [index.html](../src/index.html#L186)、[api.js](../src/global/api.js#L2942)、[server.js](../src/controllers/server.js#L204)、[chart/plugin.js](../src/expendPlugins/chart/plugin.js#L46) | D/E   | 调试信息走可关闭、可脱敏的 logger；不通过屏蔽整个 console 掩盖错误                                    |
| 构建 banner/npm 名称/资源文件名/source map | [gulpfile.js](../gulpfile.js#L35)、[package.json](../package.json)、[index.js](../src/index.js)                                                                                         | E     | 开发工具中可识别来源不等于正常 UI 去品牌失败；公共包入口中性化，法律信息保留                          |
| 初始化失败中的 `[luckysheet]`              | [luckysheet-loader.js](../integration/vue/luckysheet-loader.js#L43)                                                                                                                     | C/D/E | facade 转为结构化 SDK 错误；底层诊断可留在调试 details，不能原样弹给用户                              |

未确认存在网格内独立“About Luckysheet”按钮。已确认的 About 位于文档站；公式帮助必须保留。**NEED VERIFY**：第三方 chartmix 动态 UI、图形内容、生成文件元信息和 favicon 请求应在实际产品构建中再查，避免把所有 `help` 字符串当品牌删除。

## 5. Icon、图片、字体、CSS 与网络资源清单

### 5.1 资源族及替换难度

| 资源族                  | 源码位置                                                                                                              | 分类/难度 | 建议                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Luckysheet iconfont     | `src/assets/iconfont/iconfont.css/.json/.js/.svg/.eot/.ttf/.woff/.woff2`                                              | E，中高   | CSS `:before` 字码；CSS 还内嵌 WOFF2。旧内部 UI 留在兼容皮肤；新 UI 不引用其类名                                                                |
| iconfont 与布局映射     | [constant.js](../src/controllers/constant.js#L1414) `iconfontObjects`；[iconCustom.css](../src/css/iconCustom.css#L1) | E，高     | 边框/对齐/换行/旋转状态和偏移强耦合；按控件替换，不做全局 class rename                                                                          |
| Font Awesome 4.7.0      | [font-awesome.min.css](../src/plugins/font-awesome.min.css#L1)；`src/fonts/*`                                         | E，中     | 箭头/勾选/图片操作/加载等引用 `.fa`；移除前逐一覆盖。字体与 CSS 许可不同                                                                        |
| SVG sprite              | [menuSprite.svg](../src/css/menuSprite.svg)、[sprite38.svg](../src/css/sprite38.svg)                                  | E，待核实 | 资源存在；本轮未证明每个 symbol 仍有运行调用，先做引用/网络/截图确认                                                                            |
| PNG sprite              | [waffle_sprite.png](../src/css/waffle_sprite.png)；[core.css](../src/css/luckysheet-core.css#L1692)                   | E，高     | 位移坐标选择字形，不能用一个 SVG 文件覆盖替换                                                                                                   |
| 下拉箭头/格式刷鼠标     | `src/css/arrow-down.png`、`paint_16px.ico/paint_24px.ico/paint_32px.ico`                                              | A/E，中   | CSS L7197/L5092；格式刷光标属于交互，不是 Logo                                                                                                  |
| 复制选区蚂蚁线          | `src/css/EwaAntH.gif/EwaAntV.gif`；CSS L1900                                                                          | A/E，中   | 功能动画需保留或用等效本地实现替换                                                                                                              |
| Loading GIF、缩放内嵌图 | `src/css/loading.gif`、`luckysheet-zoom.css`                                                                          | B/E，中   | 区分备用 GIF、主 SVG loading 和单元格加载三条路径                                                                                               |
| 条件格式素材            | `src/plugins/images/CFdataBar.png/CFcolorGradation.png/CFicons.png`；`constant.js` L1410 内嵌 PNG                     | A/E，高   | 既有 CSS 也有 Canvas 精灵截取；变更不能改变工作簿条件格式含义                                                                                   |
| 下拉填充素材            | `src/plugins/images/icon_dropCell.png`；CSS L6225                                                                     | A/E，中   | 随下拉控件替换                                                                                                                                  |
| jQuery UI 图标集        | `src/plugins/images/ui-icons_{444444,555555,777620,777777,cc0000,ffffff}_256x240.png`                                 | E，中     | jQuery UI CSS 多主题 sprite；先替换使用者，再删资源                                                                                             |
| 分页素材                | `src/plugins/images/js.png`、[jquery.sPage.css](../src/plugins/jquery.sPage.css#L45)                                  | B/C       | 产品分页归 Ledger 列表，Spreadsheet 底部分页默认关闭                                                                                            |
| 展示字体                | `src/assets/iconfont/Anton-Regular.ttf/HanaleiFill-Regular.ttf/Pacifico-Regular.ttf`                                  | E，待核实 | `index.html:98` 配置三字体，`menuButton.js:5293` 注册 FontFace；文件随 assets 拷贝，实际字体载入及每个字体许可证待核验，不推断为根 MIT 自动覆盖 |
| 系统字体/单元格字体数组 | `locale/*.js` 的 `fontarray`；[constant.js](../src/controllers/constant.js#L1400)；`core.js` `fontList`               | A/E       | 保留历史单元格字体，产品 UI 默认字体与文档字体分离                                                                                              |
| 核心 CSS                | `luckysheet-core.css/cellFormat.css/protection.css/zoom.css` 的实际全名见目录；`iconCustom.css`                       | A/E，高   | 有全局 scrollbar 规则、`.luckysheet *` 的 `box-sizing/outline`、超大 z-index；需作用域和层级适配                                                |
| 第三方 CSS              | `src/plugins/css/spectrum.min.css`、`jquery-ui.min.css/jquery-ui.theme.min.css`、flatpickr light theme                | E，高     | `.ui-*`/`.sp-*`/`.flatpickr-*` 可出现在根外；与宿主样式冲突需运行验证                                                                           |
| 图表样式和运行时        | `src/expendPlugins/chart/chartmix.css/chartmix.umd.min.js/.map`                                                       | E，高     | 自带框架皮肤和全局对象；不进入默认产品包                                                                                                        |

静态资产存在不等于必须加载，静态扫描命中不等于网络请求发生。构建中的 `copyStaticAssets/copyStaticExpendPlugins` 会拷贝目录；必须再以实际包内容和网络记录判定发布范围。

### 5.2 外部网络与资源入口

| 来源/地址族                                                | 源码定位                                                                                                                                 | 实际性质                                | 产品处理                                           |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------- |
| `unpkg.com` 的 Vue/Vuex/Element UI/ECharts                 | [chart/plugin.js](../src/expendPlugins/chart/plugin.js#L25)                                                                              | 图表初始化时的可执行资源加载            | 关闭旧插件；新插件固定版本本地分发                 |
| 相对 `./expendPlugins/chart/*`                             | 同上 L30–35                                                                                                                              | chartmix 脚本及 CSS                     | 通过实例资源解析器，不依赖当前页面 URL             |
| `localhost:3002/luckyToXlsx`                               | [index.html](../src/index.html#L93)、[exportXlsx/plugin.js](../src/expendPlugins/exportXlsx/plugin.js#L30)                               | demo 导出服务器配置及整包上传实现       | 产品使用授权导出任务，不能照搬地址                 |
| `/luckysheet/api/*` 与 `/luckysheet/websocket/luckysheet`  | [index.html](../src/index.html#L72)、[server.js](../src/controllers/server.js#L176)                                                      | demo/旧数据与协同协议                   | 产品禁用旧自动网络；不接入 Workflow                |
| `luckysheet.lashuju.com`                                   | [gulpfile.js](../gulpfile.js#L133)                                                                                                       | 开发服务器代理目标                      | 不进入产品开发/部署默认数据流                      |
| `at/img/g/a1.alicdn.com`、`iconfont.cn`                    | [demo.css](../src/assets/iconfont/demo.css#L1)、[demo_index.html](../src/assets/iconfont/demo_index.html#L1)                             | 图标展示页字体、JS/图片及导航           | 从产品资源清单排除演示页面，不误报为网格必需       |
| `support.qq.com/groups.google.com`                         | [demoFeature.js](../src/demoData/demoFeature.js#L18)                                                                                     | demo 帮助导航                           | 自有帮助入口替代                                   |
| Airtable 示例/请求                                         | [getTargetData.js](../src/demoData/getTargetData.js#L5448)、[functionListDescriptor.js](../src/function/functionListDescriptor.js#L1121) | demo 数据和函数示例；是否启用依调用路径 | 不随产品发布 demo；远程公式需要显式启用            |
| 图片、头像、超链接、自定义 loading URL                     | `imageCtrl`、`constant.gridHTML`、`hyperlinkCtrl`、`customLoadingConfig`                                                                 | 数据或配置驱动，地址无法靠源码穷举      | 资源解析、授权与协议策略；运行时网络清单验收       |
| `Worker('./plugins/Worker-helper.js')`                     | [editor.js](../src/global/editor.js#L41)                                                                                                 | IE 分支引用，当前未找到对应文件         | 标记历史缺件，不将 IE 支持写成已完成               |
| `w3.org`、`bohemiancoding.com`、注释中的 `ssl.gstatic.com` | SVG namespace/编辑元数据、CSS L4653 等注释                                                                                               | 不是可执行 CDN 加载证据                 | 不为去品牌破坏 SVG namespace；注释与运行流分别记录 |

### 5.3 许可证与来源

[根 LICENSE](../LICENSE) 是 MIT，版权行为 `Copyright (c) 2020-present, Mengshukeji`。本轮未在项目源码树中发现独立 NOTICE 文件；**这不意味着可以删除许可或第三方归属**。发行包要包含上游许可、修改记录和第三方清单。MIT 对版权及许可声明的保留要求见 [OSI 正文](https://opensource.org/license/mit)。正常 UI 不需冒用上游品牌，“开源组件说明”可以在宿主设置/帮助中独立提供。

Font Awesome 本地头部确认 4.7.0；字体为 SIL OFL 1.1、CSS 为 MIT，文档另有许可，按资产类别保存声明，见 [官方 v4 许可](https://fontawesome.com/v4/license/)。iconfont、自定义字体、sprite、chartmix 和压缩第三方库未找到足够的随附来源/许可信息时标记 NEED VERIFY，不用根 MIT 作兜底结论。

第三方清单至少覆盖：jQuery、jQuery UI、mousewheel、Spectrum、clipboard、html2canvas、localforage、lodash、jStat、crypto-api、sPage、uuid、flatpickr、dayjs、numeral、pako，以及图表依赖及字体素材。根 `.gitignore` 忽略 `package-lock.json/yarn.lock`，且 Git 未跟踪这两份锁文件；即使本地生成 lockfile，也覆盖不到所有手工内嵌库，必须同时检查 `src/plugins` 和 `src/expendPlugins`。

## 6. 可行性、顺序与验收

用户视觉去品牌难度为**中等**：标题、信息栏、Logo、默认配置和主 Toolbar 可先替换；完全覆盖公式帮助、所有弹窗、错误、Canvas、第三方插件及离线资源是**高耦合的渐进任务**。正常使用时基本感知不到 Luckysheet 是可实现的目标；不能承诺在 DevTools、source map、许可证或历史兼容数据里彻底不可识别。

执行顺序：建立 UI fixture/网络基线 → 新宿主 Shell 与中性 SDK facade → 关闭原业务头部/默认外网及不完整插件 → 自有 Toolbar 与状态订阅 → 文案/消息服务 → 实例样式及 Canvas token → 复杂插件迁移。详见 [下一阶段任务](./next-stage-tasks.md)。

验收需覆盖：初始化/取消/失败、编辑/IME、每个 Toolbar 组、右键及快捷键、公式帮助、查找替换未命中、错误输入、图片/验证/条件格式、Sheet 菜单、全屏/缩放/隐藏恢复、只读、附件/审批侧栏、导出/打印能力关闭、四语言回退、卸载后资源、产品构建网络和许可文件。测试在宿主表单/弹窗旁运行，不能只打开全屏 demo。

产品正常 UI 中禁止出现 Logo、默认 Demo 名、内置函数的品牌分类、上游帮助跳转和原始 loader 错误；保留列表允许 LICENSE、第三方归属和引擎维护文档。检索 DOM **可见文本及可访问名称**，不以内部 class 含 `luckysheet` 作为失败条件。

## 7. 与既有 SDK 文档的关系及待补充项

原 SDK 方向无需推翻。本轮补充以下源码事实/契约，原文的目标能力不能误读为已实现：

| 原文位置            | 补充内容                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| §2.4、§6.1 插件     | 注册表只接图表；打印缺实现、导出依赖外部服务；能力表增加 unavailable 状态                                                           |
| §4 API/§6.2 UI 扩展 | 自定义 Toolbar 需要 `getSelection/getSelectionState/getCapabilities`、editing/selection/history 事件及 `commitEdit()`；不能读旧 DOM |
| §4.2 只读           | 增加计算后 Range/Field 策略的 SDK 表达；业务服务端才是授权权威，原表格保护不等价                                                    |
| §5 快照             | Ledger 身份、Workflow、附件、审计、Record 绑定属于外层 Revision Manifest，不把快照扩大为业务数据库                                  |
| §6.2 主题           | 全局 scrollbar、超大 loading z-index、Canvas 硬编码颜色、内嵌字体和 sprite 要逐项验收                                               |
| §7 质量             | 产品提交还需版本冲突、服务端字段抽取、权限变化和流程固定修订测试                                                                    |

NEED VERIFY：实际隐藏配置组合的副作用；去工具栏后各旧 API 的可用性；`freezen/frozen` 数据往返；多语言第三方弹层；复杂格式、打印及 XLSX 保真；所有资源来源/许可；产品目标浏览器及输入法行为。这些均进入任务和发布门禁，不标为已完成。

## 8. 源码复核补充与可执行改造依据

### 8.1 配置真值、缺口和初始化链

| 项目          | 真实实现位置                                                            | 结论/首版决策                                                                                                                           |
| ------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 工具栏总开关  | `toolbar.js:815–860`；`resize.js:330–425`                               | 数组模式 false 直接返回空；对象模式先全 false 再 Object.assign，子项可重新开启。SDK 禁止宿主透传旧对象配置                              |
| Sheet Bar     | `resize.js:480–545`                                                     | add/menu/sheet 子项覆盖 showsheetbar，逐项隐藏但缺少对应子项 show；动态恢复必须新增接缝/测试                                            |
| Status Bar    | `resize.js:548–611`                                                     | count/view/zoom 覆盖总开关；只隐藏子项，初始化结果缓存。静态配置可映射，动态切换未实现承诺                                              |
| 原信息栏      | `resize.js:15`；`constant.js:19`；`api.js:6724`                         | `showinfobar=false` 隐藏节点，未删除；toJson 仍依赖该 input。产品标题归宿主，新 codec 不读隐藏 input                                    |
| 默认 loading  | `constant.js:1200–1295`；`locale/zh.js:6155` 等                         | 默认中性 SVG 与本地化“渲染中”；不用更换品牌 Logo 的名义删掉它。SDK 初始化 loading 与宿主网络保存状态分开                                |
| 字体加载      | `index.html:98–110`；`sheetmanage.js:879`；`menuButton.js:5293–5345`    | Demo 配置三份 TTF，FontFace 注册到 document.fonts；不能仅替换 fontarray 就声称实例字体独立                                              |
| 语言切换      | `locale/locale.js:1–13`；`api.js:6747`；`core.js:138`                   | locale 表有 en/zh/es/zh_tw；changLang 只接受前三个并重建全局实例。目标 Locale API 不可直接复用该重建行为                                |
| 默认用户/导航 | `config.js:19–23`；`constant.js:11–55`                                  | userInfo 默认 false，设置 true 才显示 Lucky；Logo 随 infobar，导航地址是默认配置。不要把可配置分支写成始终可见                          |
| 插件链        | `core.js:140–146`；`controllers/expendPlugins.js:3–17`；`index.html:93` | 未知名称直接调用 undefined；demo 会请求 chart/exportXlsx/print，可能在初始化时中断。图表请求已经发出后失败如何清理 NEED VERIFY          |
| 旧修改事件    | `controllers/listener.js:10–41`；`api.js:233`                           | updated 由历史 Proxy 触发，cellUpdated 是延时回调且读当前 flowdata；不能保证非活动 Sheet、卸载后的事件正确归属                          |
| 序列化        | `api.js:5908–5921,6719–6739`；`core.js:48–57`                           | getAllSheets 复制并补 celldata，仍可同时保留 data，删除 freezen；toJson 是初始化选项对象，含宿主配置风险。冻结兼容需区分 frozen/freezen |
| 旧保护        | `protection.js:917–966`；`api.js:115–257`                               | lo/hi 在 authority 开启时控制局部行为；setCellValue 本身未统一检查业务 readonly/权限，不得以 allowEdit=false 为全部 API 门禁            |

产品入口的**拟定 legacy preset，仅由 bridge 内部生成**：`showinfobar=false`、`showtoolbar=false + showtoolbarConfig=[]`、`userInfo=false`、`functionButton=''`、`plugins=[]`、`loadUrl/loadSheetUrl/updateUrl/updateImageUrl=''`、`allowUpdate=false`；保留 formulaBar/Sheet Tab/选区统计和缩放，关闭打印视图，关闭底部任意加行。单元格菜单按全部已知项显式配置，先保留有命令和权限覆盖的操作；工作表结构菜单在填报模式禁用。配置影响 UI，不代替命令/服务端授权。presets 仍须通过真实页面确认，不直接照此认定动态更新可用。

### 8.2 补充 UI 支撑点和遗漏风险

| UI 支撑                             | 源码                                                                                                                   | A–E / 处理                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 行列/特殊范围定位弹窗               | `controllers/locationCell.js:93,176`                                                                                   | A/E；交互属于 SDK，不是台账搜索；公开 revealRange 另作稳定定位入口                                                |
| 图表数据点批量设置                  | `global/tooltip.js:131`；`controllers/constant.js` 的 luckysheetchartpointconfigHTML                                   | E；硬编码中文标题/按钮，关闭图表插件后仍核查此旧入口是否可达                                                      |
| 选区搜索、移动高亮、Sheet 切换      | `sheetSearch.js`、`sheetMove.js`、`selection.js`、`select.js`                                                          | A；为外部选区查询、键盘路由、附件锚点提供语义基础                                                                 |
| 拖填/格式刷/换行/旋转/分列/矩阵菜单 | `dropCell.js`、`menuButton.js`、`splitColumn.js`、`matrixOperation.js`、`constant.js:346`                              | A/B/E；业务填报可按能力禁用，但 SDK 保留已存在数据语义，不能遗漏格式刷/拖填权限旁路                               |
| 微型图和条件格式 Canvas 图标        | `sparkline.js:1927`；`conditionformat.js:1839`；`draw.js`                                                              | A/E；图形是文档内容，不能换成纯 Toolbar SVG；颜色、字体和资源逐项适配                                             |
| 实际网络数据解析                    | `core.js:169`、`sheetmanage.js:1042,1380`、`menuButton.js:3181`、`method.js:351`、`server.js:202`、`global/json.js:10` | E；禁止将新后台 JSON 交给动态代码解析；这些分支逐条关闭/迁移                                                      |
| 图片同步                            | `imageUpdateCtrl.js:2`；`imageCtrl.js`                                                                                 | E；运行请求地址由配置决定；127.0.0.1 地址是注释样例，不能误报为默认发出请求                                       |
| 文档图片/富文本/公式示例            | `demoData/sheetPicture.js`、`sheetCell.js`、`sheetFormula.js`、`data/chartJson.js`                                     | A（文档内容）/D（demo 发布）；用户导入的图片或单元格文字不应被全局品牌替换损坏                                    |
| 帮助页资产展示 CSS/JS               | `assets/iconfont/demo.css/demo_index.html/iconfont.js`                                                                 | D/E；图标 demo 用完整字形及外网示例，产品资源白名单排除 demo.css/demo_index.html，运行 iconfont.js 是否可裁剪另查 |

### 8.3 本地图标完整命名清单

`src/assets/iconfont/iconfont.json` 共 110 个 glyph。以下为原 `font_class` 全集；CSS 前缀和码点以相邻 JSON/CSS 为准，不导出为业务 Icon API。`logo/logo2` 属于 D；其余按第 3、5 节所属控件分类，未使用 glyph 属 E 待引用核实。资产存在不代表当前菜单已经呈现。

```text
lianjie dayinquyu dayinyemianpeizhi dayinbiaoti fenyeyulan putong yemianbuju
biaogesuoding zhuandao1 youjiantou caidan2 tihuan dongjie1 jian1 jia1 yichu1
shengxu1 neikuangxian qingchushaixuan wenbenxiangshang jiangxu1 neikuanghengxian
neikuangshuxian zidingyipaixu logo2 logo wenbenqingxie1 jiacu sousuo guanbi
xiayige xiala wenbenyanse shangyige shujutoushi tianchong zengjiaxiaoshuwei
bianji2 jieping jianxiaoxiaoshuwei caidan shujuku wubiankuang bianji qingchuyangshi
shanchu wenbenjuzhongduiqi dayin wenbenfenge hanshu jiangxu dingbuduiqi tupian
xiangxia90 shupaiwenzi quanjiabiankuang shengxu caijian jine caidan1 quxiaohebing
wenbenxiahuaxian shangbiankuang dingwei sizhoujiabiankuang cebianlanshouqi hebing
xiangshangqingxie shuipingduiqi wenbenshanchuxian wenbenyouduiqi qianjin tubiao
youbiankuang baifenhao geshishua baocun shujuyanzheng jieduan geshitiaojian
zidonghuanhang cebianlanzhankai shaixuan2 xiangxiaqingxie yichu chuizhihebing
wenbenfensanduiqi zuobiankuang fenyechakan yunhang lie quanping shaixuan gengxin
qingchu hang zhushi jian jisuan jia dibuduiqi xiangshang90 wuxuanzhuang
xianshiyincangwangge dongjie wenbenzuoduiqi houtui shuipinghebing xiabiankuang shezhi
```

Font Awesome 完整字形由 `src/plugins/font-awesome.min.css` 和 `src/fonts/fontawesome-webfont.svg` 定义；不能把整套字体库可用图标全算成产品正在使用的按钮。主要使用点是 `constant`、`toolbar`、`sheetBar`、`postil`、`imageCtrl`、`filter`、`protection`、`chart/plugin`，替换按照这些控件的实际 `.fa-*` 引用进行。sprite 的截取坐标由核心 CSS 和条件格式渲染定义，不能和字体码点混为同一资产映射。

### 8.4 第三方许可证据等级与发行要求

官方 MIT、Font Awesome v4、Lucide 许可链接已于 2026-09-13 核对。下表只记录本地能看到的证据，不从库名推断这份 vendored 文件一定符合上游版本。

| 文件/资产                                                  | 已知证据                                                       | 剩余动作                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `plugins/js/localforage.min.js`                            | 文件头标记 1.6.0、Mozilla、Apache License 2.0                  | 收集该版本 LICENSE/适用 NOTICE，并确认文件来源/hash                     |
| `plugins/js/jquery.mousewheel.min.js`                      | 文件头标记 3.1.13、jQuery Foundation、MIT                      | 保存完整许可与版本来源                                                  |
| `plugins/js/jquery-ui.min.js`                              | 内部 ui.version 为 1.12.1；首部未给完整许可                    | 从对应发布源确认来源、LICENSE 和本地修改                                |
| `plugins/js/html2canvas.min.js`                            | 文件头标记 0.5.0-beta3、作者，但 Released under 后缺许可证名称 | NEED VERIFY；不能依据常见新版 html2canvas 的许可自动放行                |
| `plugins/js/jquery.sPage.min.js`                           | 文件头标记 1.2.2 和上游仓库                                    | NEED VERIFY 对应源码版本及许可证                                        |
| clipboard、Spectrum、jStat、crypto-api、lodash vendored JS | 首部信息不完整/需追溯                                          | 分别查内部版本、原发布包、hash、修改记录；不能只列 npm dependency       |
| iconfont 字形、两份 SVG sprite、PNG/GIF/ICO、三份展示 TTF  | 根 MIT 无法逐项证明资产来源与字体保留名称                      | NEED VERIFY；许可不明的非必要资产排除新发行路径，必要资产先补证据或替换 |
| chartmix JS/CSS/map 与所加载框架                           | 本地 bundle 与运行 CDN 两种来源并存                            | 源码/构建/许可逐一归档，未核实时不启用新产品图表包                      |

构建 banner 的 `@preserve` 只证明有来源说明，不自动等于完整许可进入 npm 包。`package.json.files=['dist']` 与实际 `npm pack` 内容需要检查根 LICENSE 是否自动纳入、内嵌库声明是否齐全；本轮没有执行打包，不做发行合规完成声明。建议产物带 `THIRD_PARTY_NOTICES`/资产来源 manifest、核心 LICENSE 和对应第三方全文，法律归属与产品可见品牌采用两份清单管理。

### 8.5 重复审计步骤和未完成验证

1. `git ls-files src integration` 与 `rg --files --hidden --no-ignore src integration` 对照空文件/忽略规则；读取入口、构建任务、模板和各控制器。
2. 在源 JS/HTML/locale/CSS 中分别搜索用户文字、`title/aria-label/data-tips`、`alert/tooltip/modelHTML`、`body` 挂载、font/sprite/url、CDN/网络构造；压缩文件限制单行输出，避免把整个 bundle 或敏感 demo 请求打印到报告。
3. 每条命中区分执行代码、注释、文档样例、条件分支及纯 SVG namespace；图片/字体真实呈现需要浏览器/图形查看，不凭文件名判断。
4. 用两份工作表、宿主输入框/弹窗、侧栏、失败注入、只读和所有启用菜单建立浏览器清单；录制实际 Network 与可见文字/可访问名称，单列 Canvas 和动态第三方弹层。
5. 输出通过/失败/未覆盖与对应能力，确认正常编辑无默认外网请求。**本轮完成前 1–3 项静态部分，4–5 项为下一阶段任务；没有截图或性能数字可作为本轮已通过证据。**
