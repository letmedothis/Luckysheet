export interface CellType {
  t?: string;
  fa?: string;
}

export interface CellObject {
  v?: unknown;
  m?: string;
  ct?: CellType;
  f?: string;
  ps?: unknown;
  qp?: number;
  tb?: string;
  [attr: string]: unknown;
}

export type FlowData = Array<Array<CellObject | null> | null>;

export interface SheetFile {
  index: string | number;
  name?: string;
  data?: FlowData;
  celldata?: CellObject[];
  config?: Record<string, unknown>;
  [attr: string]: unknown;
}
