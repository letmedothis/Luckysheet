// 主网格 canvas 注册表：收口散落的 $("#luckysheetTableContent").get(0).getContext("2d") 取用点。
// 缓存以 DOM 存活性(isConnected)自愈，create/destroy 重建 DOM 后无需手动失效。

export const GRID_CANVAS_ID = "luckysheetTableContent";
export const MEASURE_CANVAS_ID = "luckysheetTableContentF";

interface CanvasEntry {
  el: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
}

const entries = new Map<string, CanvasEntry>();

function refreshEntry(id: string): CanvasEntry | undefined {
  const el = document.getElementById(id);
  if (el == null || !(el instanceof HTMLCanvasElement)) {
    entries.delete(id);
    return undefined;
  }
  const entry: CanvasEntry = { el, ctx: null };
  entries.set(id, entry);
  return entry;
}

export function getCanvas(id: string): HTMLCanvasElement | null {
  let entry = entries.get(id);
  if (entry == null || !entry.el.isConnected) {
    entry = refreshEntry(id);
  }
  return entry == null ? null : entry.el;
}

// 同一 canvas 元素的 2d context 天然单例，可安全缓存
export function getContext2d(id: string): CanvasRenderingContext2D | null {
  let entry = entries.get(id);
  if (entry == null || !entry.el.isConnected) {
    entry = refreshEntry(id);
    if (entry == null) {
      return null;
    }
  }
  if (entry.ctx == null) {
    entry.ctx = entry.el.getContext("2d");
  }
  return entry.ctx;
}

export function getGridContext2d(): CanvasRenderingContext2D | null {
  return getContext2d(GRID_CANVAS_ID);
}

export function clearCanvasRegistry(): void {
  entries.clear();
}
