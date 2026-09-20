# Vue 嵌入指南

本指南说明如何将 Luckysheet 嵌入到 Vue 3 项目中。

## 1. 前置条件

- Vue 3 + Vite 项目
- Node.js >= 16

## 2. 纳入 Luckysheet 源码

将 Luckysheet 仓库作为本地依赖纳入。推荐两种方式：

### 方式 A：Yarn/PNPM Workspace（推荐）

在宿主项目根目录的 `package.json` 中：

```json
{
  "workspaces": ["packages/luckysheet"]
}
```

或在 `pnpm-workspace.yaml` 中：

```yaml
packages:
  - 'packages/luckysheet'
```

将 Luckysheet 仓库放到宿主项目的 `packages/luckysheet/` 目录。

### 方式 B：直接复制源码

将以下文件/目录复制到宿主项目：

```
your-vue-project/
├── src/
│   └── luckysheet/              ← 复制整个 src/ 目录内容
│       ├── sdk/
│       ├── store/
│       ├── global/
│       ├── controllers/
│       ├── locale/
│       └── ...
├── public/
│   └── luckysheet/              ← 复制 dist/ 中的 CSS 和字体
```

## 3. 构建配置

### 3.1 Vite 配置

在宿主项目的 `vite.config.ts` 中添加别名：

```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'luckysheet': fileURLToPath(new URL('../packages/luckysheet/src/index.esm.js', import.meta.url)),
    },
  },
});
```

如果使用直接复制方式，将别名指向复制后的路径。

### 3.2 宿主项目安装依赖

Luckysheet 依赖以下包，确保宿主项目已安装：

```bash
npm install jquery dayjs flatpickr escape-html pako numeral
```

或检查 `packages/luckysheet/package.json` 中的依赖。

## 4. 引入样式

在 `src/main.ts` 中全局引入样式：

```ts
import 'luckysheet/dist/css/luckysheet.css';
import 'luckysheet/dist/plugins/plugins.css';
import 'luckysheet/dist/plugins/css/pluginsCss.css';
import 'luckysheet/dist/assets/iconfont/iconfont.css';
```

如果使用直接复制方式，路径相应调整。

## 5. 使用组件

### 5.1 基础用法（单实例）

```vue
<template>
  <LuckysheetSheet
    v-model:data="workbookData"
    :options="sheetOptions"
    style="width: 100%; height: 600px;"
    @ready="onReady"
    @error="onError"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import LuckysheetSheet from '@/components/luckysheet/LuckysheetSheet.vue';

const sheetOptions = {
  locale: 'zh-CN',
  readonly: false,
};

const workbookData = ref({
  sheets: [
    {
      name: 'Sheet1',
      celldata: [],
    },
  ],
});

function onReady(instance: unknown) {
  console.log('Luckysheet ready', instance);
}

function onError(error: Error) {
  console.error('Luckysheet error', error);
}
</script>
```

### 5.2 多实例

同一页面渲染多个 Luckysheet 时，每个实例需要唯一的 `container`（DOM ID 或元素），并使用 `useLuckysheet` 分别管理生命周期：

```vue
<template>
  <div>
    <div ref="sheetA" style="width: 100%; height: 400px;"></div>
    <div ref="sheetB" style="width: 100%; height: 400px;"></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useLuckysheet } from '@/components/luckysheet/useLuckysheet';

const sheetA = ref<HTMLElement | null>(null);
const sheetB = ref<HTMLElement | null>(null);

const { create: createA, destroy: destroyA } = useLuckysheet(sheetA, {
  data: { sheets: [{ name: 'Sheet A', celldata: [] }] },
  autoCreate: false,
});

const { create: createB, destroy: destroyB } = useLuckysheet(sheetB, {
  data: { sheets: [{ name: 'Sheet B', celldata: [] }] },
  autoCreate: false,
});

onMounted(() => {
  createA();
  createB();
});

onBeforeUnmount(() => {
  destroyA();
  destroyB();
});
</script>
```

> **注意**：两个实例的 `container` 必须不同。如果使用 DOM ID 字符串，确保页面中不存在重复 ID；推荐直接传 `HTMLElement` 引用。

### 5.2 手动控制创建/销毁

```vue
<template>
  <div>
    <button @click="create">创建</button>
    <button @click="destroy">销毁</button>
    <div ref="container" style="width: 100%; height: 600px;"></div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useLuckysheet } from '@/components/luckysheet/useLuckysheet';

const container = ref<HTMLElement | null>(null);
const { create, destroy, instance } = useLuckysheet(container, {
  data: { sheets: [{ name: 'Sheet1', celldata: [] }] },
  autoCreate: false,
});
</script>
```

## 6. API 参考

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `data` | `object` | `{}` | 工作簿数据 |
| `options` | `object` | `{}` | 传递给 `luckysheet.create()` 的额外配置 |

### Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `ready` | `instance` | 表格创建完成 |
| `error` | `Error` | 创建失败 |

### useLuckysheet() 返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| `instance` | `Ref<unknown>` | 当前实例 |
| `loading` | `Ref<boolean>` | 是否正在创建 |
| `error` | `Ref<Error \| null>` | 错误信息 |
| `create()` | `Function` | 手动创建 |
| `destroy()` | `Function` | 手动销毁 |

## 7. 注意事项

1. **容器必须存在**：组件挂载前容器 DOM 必须已存在
2. **销毁时机**：组件卸载时会自动调用 `destroy()`，无需额外处理
3. **避免重复创建**：`data` 变化时会自动销毁重建，频繁变动会导致性能问题
4. **样式隔离**：Luckysheet 样式使用 `.luckysheet-` 前缀，注意与宿主样式冲突
5. **jQuery 依赖**：Luckysheet 内部使用 jQuery，确保宿主项目已安装

## 8. 故障排查

### 样式丢失
确认 CSS 文件路径正确，且 Vite 配置中 `assetsInclude` 包含字体文件：

```ts
export default defineConfig({
  assetsInclude: ['**/*.woff2', '**/*.ttf', '**/*.eot', '**/*.svg'],
});
```

### 字体文件 404
检查 `public/luckysheet/assets/iconfont/` 下是否有字体文件，或配置 Vite 静态资源处理。

### `window is not defined`
SSR 环境下需确保 Luckysheet 仅在客户端加载：

```vue
<script setup>
import { onMounted } from 'vue';
const isMounted = ref(false);
onMounted(() => { isMounted.value = true; });
</script>

<template>
  <LuckysheetSheet v-if="isMounted" />
</template>
```
