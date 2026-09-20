import { ref, type Ref, type ComponentInternalInstance } from 'vue';

export interface UseLuckysheetOptions {
  data?: object;
  options?: Record<string, unknown>;
  autoCreate?: boolean;
  importPath?: string;
}

export interface UseLuckysheetReturn {
  instance: Ref<unknown>;
  loading: Ref<boolean>;
  error: Ref<Error | null>;
  create: () => Promise<void>;
  destroy: () => void;
}

export function useLuckysheet(
  container: Ref<HTMLElement | null>,
  opts: UseLuckysheetOptions = {}
): UseLuckysheetReturn {
  const instance = ref<unknown>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);
  const importPath = opts.importPath ?? 'luckysheet';

  async function create() {
    if (!container.value) return;
    
    loading.value = true;
    error.value = null;

    try {
      const mod = await import(importPath);
      const api = mod.default;
      
      instance.value = api.create({
        ...opts.options,
        container: container.value,
        data: opts.data,
      });
    } catch (e) {
      error.value = e as Error;
    } finally {
      loading.value = false;
    }
  }

  function destroy() {
    if (instance.value && typeof (instance.value as any).destroy === 'function') {
      try {
        (instance.value as any).destroy();
      } catch {
        // ignore
      }
      instance.value = null;
    }
  }

  if (opts.autoCreate !== false) {
    create();
  }

  return {
    instance,
    loading,
    error,
    create,
    destroy,
  };
}

export default useLuckysheet;

