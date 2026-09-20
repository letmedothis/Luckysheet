<template>
  <div ref="root" class="ls-host" style="width: 100%; height: 100%;">
    <div v-if="loading" class="ls-loading">加载中...</div>
    <div v-else-if="error" class="ls-error">{{ error.message }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, type PropType } from 'vue';
import { useLuckysheet } from './useLuckysheet';

const props = defineProps({
  data: {
    type: Object as PropType<object>,
    default: () => ({}),
  },
  options: {
    type: Object as PropType<Record<string, unknown>>,
    default: () => ({}),
  },
  importPath: {
    type: String,
    default: 'luckysheet',
  },
});

const emit = defineEmits<{
  (e: 'ready', instance: unknown): void;
  (e: 'error', error: Error): void;
}>();

const root = ref<HTMLElement | null>(null);
const { loading, error, instance, create, destroy } = useLuckysheet(root, {
  data: props.data,
  options: props.options,
  importPath: props.importPath,
  autoCreate: false,
});

watch(
  () => props.data,
  () => {
    destroy();
    create();
  },
  { deep: true }
);

onMounted(() => {
  create();
});

onBeforeUnmount(() => {
  destroy();
});
</script>

<style scoped>
.ls-loading, .ls-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #999;
}
</style>
