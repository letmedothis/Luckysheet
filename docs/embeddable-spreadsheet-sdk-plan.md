# Luckysheet 可嵌入式 Spreadsheet UI SDK 改造方案

## 1. 背景与目标

本项目计划继续以 Luckysheet 的开源代码为基础进行维护，不迁移到 Univer。主要原因是更看重项目的开源程度、代码可控性和长期自主维护能力。

改造目标不是简单增加一个 Vue 或 React 包装组件，而是把当前项目逐步建设为一个：

- 可以嵌入 Vue、React、Angular 或原生 Web 项目的电子表格 SDK；
- 保留类似 Excel 的编辑、公式、格式、筛选、排序等核心能力；
- 支持多个相互独立的表格实例；
- 支持主题、功能开关和自定义 UI；
- 支持通过插件扩展图表、数据透视表、导入导出、打印和协同编辑；
- 对外提供稳定 API，避免宿主项目依赖内部实现。

更准确的产品定位应当是 **Spreadsheet UI SDK**，而不是类似 Ant Design 的通用 UI 组件库。

## 2. 当前项目评估

仓库目前可以生成 ESM 和 UMD 文件，也已经有一个 Vue 包装示例，但底层仍然是全局单例结构，距离真正可嵌入的 SDK 还有明显差距。

### 2.1 全局单例状态

`src/store/index.js` 直接导出全局 `Store` 对象，大量模块直接读写该对象。这意味着同一个页面中的多个表格无法拥有独立状态。

`src/core.js` 中的 `luckysheet.create()` 在创建表格前会先调用全局 `destroy()`，因此当前实现实际上只允许存在一个活动实例。

### 2.2 全局 DOM 和事件

当前代码大量使用 jQuery、`window` 和 `document`。销毁表格时还会删除 `body` 下的菜单、弹层和固定 ID 节点，并解绑 `document` 上的事件。

这些行为可能导致：

- 多个表格实例互相影响；
- 与宿主项目的 jQuery、CSS 和全局事件冲突；
- Vue 或 React 路由切换后残留事件、定时器或 DOM；
- 无法可靠地进行组件卸载和重新挂载。

### 2.3 Vue 包装器的局限

`integration/vue/Luckysheet.vue` 为容器生成了唯一 ID，也提供了创建和销毁入口，但底层仍然访问同一个全局 `window.luckysheet` 和单例 `Store`。

所以，不同容器 ID 并不等于真正的多实例支持。

### 2.4 全局资源与样式污染

`integration/vue/luckysheet-loader.js` 会向页面全局注入 CSS、jQuery、第三方插件和 UMD 文件。这种方式依赖加载顺序，也容易和宿主项目发生版本及样式冲突。

### 2.5 测试不足

项目当前缺少系统性的单元测试、交互测试和视觉回归测试。公式、复制粘贴、撤销重做、合并单元格等功能耦合较深，如果没有测试基线，直接重构很容易产生难以发现的功能退化。

### 2.6 安全和工程问题

远程加载数据的逻辑中存在通过 `new Function()` 解析响应的代码。作为供其他项目嵌入的 SDK，应改用明确的 JSON 协议和 `JSON.parse()`，避免执行不可信代码。

## 3. 目标架构

建议将系统划分为以下层次：

```text
宿主项目
  ├─ Vue Adapter
  ├─ React Adapter
  ├─ Angular Adapter
  └─ Web Component
          │
     Spreadsheet SDK
     实例、API、命令、事件
          │
   ┌──────┴──────┐
 Core / Model   UI / Renderer
 数据与公式       Canvas 与交互
          │
        Plugins
 图表、导入导出、打印、协同等
```

宿主项目只依赖公开 SDK，不直接访问 `window.luckysheet`、全局 `Store` 或内部控制器。

## 4. 对外 API 设计

新的入口应接收 `HTMLElement`，而不是依赖全局容器 ID，并且每次创建都返回独立实例。

```ts
const sheet = await createSpreadsheet(containerElement, {
  data,
  locale: "zh-CN",
  readonly: false,
  features: ["formula", "filter", "validation"],
  theme,
});

sheet.setCellValue(0, 0, "hello");
sheet.load(snapshot);
sheet.getSnapshot();
sheet.execute("sheet.set-cell-value", {
  row: 0,
  column: 0,
  value: "hello",
});
sheet.on("cell-change", handler);
sheet.registerPlugin(plugin);
sheet.resize();
sheet.destroy();
```

建议公开的实例能力包括：

- `load()`：加载工作簿数据；
- `getSnapshot()`：获得可持久化数据；
- `execute()`：执行统一命令；
- `on()` / `off()`：订阅和取消订阅事件；
- `registerPlugin()`：注册扩展插件；
- `resize()`：响应容器尺寸变化；
- `destroy()`：完整释放当前实例资源。

## 5. 分阶段实施方案

### 阶段一：建立功能和性能基线

在修改底层架构之前，先建立 Excel 核心能力的回归保护。

功能优先级建议如下：

- P0：单元格编辑、公式、格式、合并、行列操作、复制粘贴、撤销重做、冻结、筛选和排序；
- P1：条件格式、数据验证、图片、批注和自定义公式；
- P2：图表、数据透视表、XLSX 导入导出、打印和协同编辑。

建议建立：

- 单元测试：数据模型、公式和数据转换；
- API 契约测试：公开方法的输入、输出和异常；
- Playwright 交互测试：编辑、快捷键、菜单和剪贴板；
- 截图回归测试：工具栏、表格和弹层；
- 生命周期测试：创建、销毁、重复挂载和路由切换；
- 性能基线：不同数据规模的初始化、计算和滚动耗时。

### 阶段二：引入实例和运行时上下文

将全局 `Store` 改造成状态工厂：

```js
export function createStore() {
  return {
    container: null,
    flowdata: [],
    config: {},
    selection: [],
    undoStack: [],
    redoStack: [],
  };
}
```

为每个表格实例建立独立运行时：

```ts
interface SpreadsheetRuntime {
  id: string;
  root: HTMLElement;
  overlayRoot: HTMLElement;
  store: SpreadsheetStore;
  events: EventManager;
  commands: CommandManager;
  services: ServiceContainer;
}
```

`createSpreadsheet()` 负责创建运行时和实例，`destroy()` 只能清理对应实例，不能影响页面上的其他表格或宿主应用。

这是整个改造中优先级最高、影响范围最大的一步。

### 阶段三：隔离 DOM、弹层和事件

所有 DOM 查询都必须限制在当前实例范围内：

```js
runtime.root.querySelector(".luckysheet-cell-main");
runtime.overlayRoot.appendChild(dialog);
runtime.events.listen(element, "click", handler);
```

销毁实例时，由统一的资源管理器进行清理：

```js
runtime.events.dispose();
runtime.overlayRoot.remove();
runtime.root.replaceChildren();
```

键盘和剪贴板等必须监听 `document` 的能力，可以建立一个全局事件路由器，根据焦点和事件目标，将事件转发给当前激活的表格实例。

### 阶段四：建立统一命令系统

所有会修改工作簿的操作都应通过命令执行，而不是由 UI 直接修改 `Store.flowdata`。

```ts
interface Command {
  id: string;
  execute(context, params): CommandResult;
  undo?(context, result): void;
}
```

典型命令包括：

```text
sheet.set-cell-value
sheet.insert-row
sheet.delete-column
sheet.merge-cells
sheet.set-format
sheet.sort-range
sheet.add-worksheet
```

工具栏、右键菜单、快捷键、插件和外部 API 都应调用相同命令。这样可以统一实现撤销重做、权限、操作日志、协同编辑和测试。

### 阶段五：插件化 Excel 功能

建议定义统一插件契约：

```ts
interface SpreadsheetPlugin {
  name: string;
  setup(context: PluginContext): void;
  dispose?(): void;
}
```

功能可以按以下方式拆分：

```text
内核必选
  model
  renderer
  selection
  edit
  formula
  undo-redo

标准插件
  filter
  sort
  validation
  conditional-format
  comments
  image

高级插件
  chart
  pivot-table
  import-xlsx
  export-xlsx
  print
  collaboration
```

初期不需要立即移动全部文件。可以先为现有功能增加插件注册入口，等依赖关系和接口稳定后再逐步调整目录。

### 阶段六：主题和 UI 定制

可嵌入 SDK 需要避免污染宿主项目样式：

- 所有 CSS 类增加统一命名空间，例如 `ls-`；
- 全局选择器改为根节点作用域；
- 颜色、字体和尺寸使用 CSS Variables；
- 菜单、弹窗和提示层挂载到实例的 `overlayRoot`；
- 工具栏、公式栏和状态栏支持隐藏、插槽或替换；
- 初期先做好 CSS 作用域，不强制使用 Shadow DOM。

示例主题变量：

```css
.ls-root {
  --ls-color-primary: #1677ff;
  --ls-background: #ffffff;
  --ls-border-color: #e5e7eb;
  --ls-font-family: Arial, sans-serif;
}
```

### 阶段七：发布多框架适配包

UI 框架适配层应保持轻量，只负责：

- 创建和销毁实例；
- 将属性转换成 SDK 配置；
- 将 SDK 事件转换成框架事件；
- 响应容器尺寸和组件生命周期。

所有表格业务逻辑都应保留在 SDK 中，不能分别在 Vue 和 React 组件里实现。

## 6. 推荐仓库结构

当实例化改造稳定后，可以逐步调整为：

```text
packages/
  core/                  # 工作簿、工作表和单元格模型
  formula/               # 公式解析和计算
  renderer/              # Canvas 渲染
  ui/                    # 工具栏、菜单和弹层
  sdk/                   # 对外公开 API
  plugin-filter/
  plugin-validation/
  plugin-chart/
  plugin-xlsx/
  plugin-print/
  adapter-vue/
  adapter-react/
  web-component/
  theme-default/

examples/
  vanilla/
  vue/
  react/
  multi-instance/

tests/
  unit/
  contract/
  e2e/
  visual/
  performance/
```

建议发布以下入口：

```text
@your-scope/spreadsheet
@your-scope/spreadsheet/vue
@your-scope/spreadsheet/react
@your-scope/spreadsheet/element
@your-scope/spreadsheet/plugins/chart
```

默认输出 ESM，并根据兼容需求保留 UMD。业务方不应再负责手动按照特定顺序加载 jQuery、插件脚本和多个全局 CSS 文件。

## 7. 实施原则与注意事项

### 7.1 不进行一次性重写

Luckysheet 的公式、渲染和交互逻辑耦合较深，一次性重写风险过高。应采用渐进式方式：先建立测试和实例边界，再逐个模块替换内部实现。

### 7.2 不先做全面 TypeScript 迁移

TypeScript 有助于长期维护，但不能解决单例、DOM 污染和生命周期问题。建议先定义公开接口和运行时类型，再通过 `allowJs` 或 JSDoc 渐进迁移。

### 7.3 不先全面替换 jQuery

jQuery 最终应逐步移除，但第一优先级是将其查询和事件限制在当前实例范围内。完成实例隔离后，再分模块替换为原生 DOM API。

### 7.4 不先重写 Canvas 渲染器

除非性能测试证明当前渲染器无法满足目标，否则应先保留现有渲染逻辑。实例化、命令化和生命周期管理的收益更高，也更直接影响嵌入能力。

### 7.5 保持数据兼容

第一阶段应继续支持现有 Luckysheet 数据格式。新的公开 Snapshot 格式需要包含版本号，并允许通过 `extensions` 保存尚未标准化的图表、透视表等高级数据，避免迁移过程中丢失信息。

## 8. 建议的执行顺序

1. 建立测试和性能基线；
2. 定义 `SpreadsheetInstance` 公开接口；
3. 使用实例接口包装当前 Luckysheet，暂时保留单实例限制；
4. 把全局 `Store` 改造成实例状态；
5. 改造 DOM 查询、弹层、事件和销毁流程；
6. 验证同一页面多实例；
7. 建立命令系统并迁移撤销重做；
8. 将标准能力和高级能力逐步插件化；
9. 建立主题系统和 Vue、React、Web Component 适配层；
10. 最后升级构建工具，并渐进引入 TypeScript。

## 9. 第一轮建议交付内容

第一轮不追求完成全部架构，建议只交付以下内容：

1. 自动化测试骨架和首批 P0 测试；
2. `SpreadsheetInstance` 对外接口；
3. `SpreadsheetRuntime` 运行时上下文；
4. 新的 `createSpreadsheet(container, options)` 入口；
5. 当前全局实现的兼容适配层；
6. 一个原生嵌入示例和一个多实例测试页面。

完成这些内容后，项目会拥有明确的演进边界，后续才能安全地进行 Store 实例化、事件隔离和插件拆分。
