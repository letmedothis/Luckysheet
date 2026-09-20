type GlobalState = Record<PropertyKey, unknown>;

export class GlobalState {
  private readonly _state: GlobalState;
  private readonly _prefix: string;

  constructor(instanceId: string) {
    this._prefix = `luckysheet_${instanceId}`;
    this._state = Object.create(null) as GlobalState;
  }

  get(key: PropertyKey): unknown {
    return this._state[key];
  }

  set(key: PropertyKey, value: unknown): void {
    this._state[key] = value;
  }

  delete(key: PropertyKey): void {
    delete this._state[key];
  }

  clear(): void {
    for (const key of Object.keys(this._state)) {
      delete this._state[key];
    }
  }

  get prefix(): string {
    return this._prefix;
  }
}
