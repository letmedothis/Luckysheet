declare module 'luckysheet' {
  interface LuckysheetOptions {
    container: string | HTMLElement;
    data?: object[];
    [key: string]: unknown;
  }

  interface LuckysheetInstance {
    create(options: LuckysheetOptions): void;
    destroy(): void;
    createWithRuntime(options: LuckysheetOptions, runtime?: SpreadsheetRuntime): void;
    [key: string]: unknown;
  }

  interface SpreadsheetRuntime {
    readonly id: string;
    readonly store: Record<PropertyKey, unknown>;
    readonly container: HTMLElement;
    readonly destroyed: boolean;
    registerResource(disposer: () => void): void;
    destroy(): void;
  }

  const luckysheet: LuckysheetInstance & {
    SpreadsheetRuntime: new (options: {
      id?: string;
      container: HTMLElement;
      signal?: AbortSignal;
    }) => SpreadsheetRuntime;
  };
  export default luckysheet;
}
