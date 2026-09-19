// 领域数据: sheet 集合、当前表数据、用户配置
// 迁移自 store/index.js，字段名与初始值保持不变
import type { CellObject, FlowData, SheetFile } from "./types";

export interface DataStore {
  container: string | null;
  luckysheetfile: SheetFile[] | null;
  defaultcolumnNum: number;
  defaultrowNum: number;
  fullscreenmode: boolean;
  currentSheetIndex: string | number;
  calculateSheetIndex: string | number;
  flowdata: FlowData;
  config: Record<string, unknown>;
  functionList: Record<string, unknown> | null;
  luckysheet_function: Record<string, unknown> | null;
  lang: string;
  fontList: string[];
  defaultFontSize: number;
  defaultCell: CellObject;
  conditionFormatCells: Record<string, unknown>;
  [runtimeKey: string]: unknown;
}

const dataStore: DataStore = {
  container: null,
  luckysheetfile: null,
  defaultcolumnNum: 60,
  defaultrowNum: 84,
  fullscreenmode: true,

  currentSheetIndex: 0,
  calculateSheetIndex: 0,
  flowdata: [],
  config: {},

  functionList: null, //function list explanation
  luckysheet_function: null,

  lang: "en", //language
  fontList: [],
  defaultFontSize: 10,

  // 默认单元格
  defaultCell: {
    bg: null,
    bl: 0,
    ct: { fa: "General", t: "n" },
    fc: "rgb(51, 51, 51)",
    ff: 0,
    fs: 11,
    ht: 1,
    it: 0,
    vt: 1,
    m: "",
    v: "",
  },

  conditionFormatCells: {}, // 条件格式高亮的单元格
};

export default dataStore;
