// 视口与渲染输入: 布局度量、行列可见性、文本测量缓存、缩放
// 迁移自 store/index.js，字段名与初始值保持不变
const viewStore = {
  devicePixelRatio: 1,

  visibledatarow: [],
  visibledatacolumn: [],
  ch_width: 0,
  rh_height: 0,

  cellmainWidth: 0,
  cellmainHeight: 0,
  toolbarHeight: 0,
  infobarHeight: 0,
  calculatebarHeight: 0,
  rowHeaderWidth: 46,
  columnHeaderHeight: 20,
  cellMainSrollBarSize: 12,
  sheetBarHeight: 31,
  statisticBarHeight: 23,
  luckysheetTableContentHW: [0, 0],

  defaultcollen: 73,
  defaultrowlen: 19,

  measureTextCache: {},
  measureTextCellInfoCache: {},
  measureTextCacheTimeOut: null,
  cellOverflowMapCache: {},

  zoomRatio: 1,

  visibledatacolumn_unique: null,
  visibledatarow_unique: null,

  showGridLines: true,

  currentSheetView: "viewNormal",

  // Resources that currently need to be loaded asynchronously, especially plugins. 'Core' marks the core rendering process.
  asyncLoad: ["core"],
};

export default viewStore;
