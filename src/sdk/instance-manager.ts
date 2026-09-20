import { SpreadsheetRuntime } from "./runtime";

type Listener = () => void;

class InstanceManager {
  private static _instance: InstanceManager;
  private readonly _runtimes = new Map<string, SpreadsheetRuntime>();
  private _activeId: string | null = null;
  private _listeners = new Set<Listener>();

  private constructor() {}

  static get instance(): InstanceManager {
    if (!InstanceManager._instance) {
      InstanceManager._instance = new InstanceManager();
    }
    return InstanceManager._instance;
  }

  register(runtime: SpreadsheetRuntime): void {
    this._runtimes.set(runtime.id, runtime);
    this._setActive(runtime.id);
    this._notify();
  }

  unregister(id: string): void {
    const runtime = this._runtimes.get(id);
    this._runtimes.delete(id);
    if (this._activeId === id) {
      this._activeId = this._runtimes.size > 0
        ? Array.from(this._runtimes.keys()).pop()!
        : null;
    }
    this._notify();
  }

  getActive(): SpreadsheetRuntime | null {
    return this._activeId ? this._runtimes.get(this._activeId) || null : null;
  }

  getById(id: string): SpreadsheetRuntime | undefined {
    return this._runtimes.get(id);
  }

  getAll(): SpreadsheetRuntime[] {
    return Array.from(this._runtimes.values());
  }

  get size(): number {
    return this._runtimes.size;
  }

  onChange(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _setActive(id: string): void {
    this._activeId = id;
  }

  private _notify(): void {
    for (const listener of Array.from(this._listeners)) {
      try {
        listener();
      } catch {
        // ignore listener errors
      }
    }
  }
}

export const instanceManager = InstanceManager.instance;
