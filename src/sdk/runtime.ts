import { createInstanceStore } from "../store";
import { createInstanceId } from "./instance-id";

export type ResourceDisposer = () => void;

export interface RuntimeOptions {
  id?: string;
  container: HTMLElement;
  signal?: AbortSignal;
}

export class SpreadsheetRuntime {
  readonly id: string;
  readonly store: ReturnType<typeof createInstanceStore>;
  readonly container: HTMLElement;
  readonly signal: AbortSignal;

  private disposers: ResourceDisposer[] = [];
  private _destroyed = false;
  private _abortController: AbortController;

  constructor(options: RuntimeOptions) {
    this.id = options.id || createInstanceId();
    this.container = options.container;
    this.signal = options.signal ?? new AbortController().signal;
    this._abortController = this.signal.controller ?? new AbortController();
    this.store = createInstanceStore();

    if (this.signal.aborted) {
      throw new Error(`[spreadsheet] instance ${this.id} creation cancelled`);
    }

    this.signal.addEventListener("abort", () => {
      this.destroy();
    });
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

  get abortController(): AbortController {
    return this._abortController;
  }

  registerResource(disposer: ResourceDisposer): void {
    if (this._destroyed) {
      try {
        disposer();
      } catch {
        // ignore
      }
      return;
    }
    this.disposers.push(disposer);
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this._abortController.abort();

    for (let i = this.disposers.length - 1; i >= 0; i--) {
      try {
        this.disposers[i]();
      } catch {
        // continue releasing other resources
      }
    }
    this.disposers = [];
  }
}
