let instanceIdCounter = 0;

export function createInstanceId(): string {
  return `sheet-${++instanceIdCounter}-${Date.now()}`;
}
