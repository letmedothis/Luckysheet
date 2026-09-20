import { getActiveStore } from "../store";

let instanceIdCounter = 0;

export function createInstanceId(): string {
  return `sheet-${++instanceIdCounter}-${Date.now()}`;
}

export function getInstanceContainer(): string {
  const store = getActiveStore();
  return (store.container as string) || "luckysheet-default";
}

export function instanceId(base: string): string {
  const container = getInstanceContainer();
  return `luckysheet-${container}-${base}`;
}

export function instanceSelector(base: string): string {
  return `#${instanceId(base)}`;
}
