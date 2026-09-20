import { getActiveStore } from "../store";

let instanceIdCounter = 0;

export function createInstanceId(): string {
  return `sheet-${++instanceIdCounter}-${Date.now()}`;
}

export function getInstancePrefix(): string {
  const store = getActiveStore();
  const container = store.container;
  if (container && typeof container === "string") {
    return container;
  }
  return `luckysheet-default`;
}

export function domId(base: string): string {
  return `luckysheet-${getInstancePrefix()}-${base}`;
}

export function domSelector(base: string): string {
  return `#luckysheet-${getInstancePrefix()}-${base}`;
}
