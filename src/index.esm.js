import "./utils/math";
import { luckysheet } from "./core";
import __firefox from "./utils/polyfill";
import { registerCellPainter, unregisterCellPainter } from "./render/cellPainters";

if (window.addEventListener && navigator.userAgent.indexOf("Firefox") > 0) {
    __firefox();
}

// UMD 纯默认导出：window.luckysheet 即表格对象本身
luckysheet.registerCellPainter = registerCellPainter;
luckysheet.unregisterCellPainter = unregisterCellPainter;

export default luckysheet;
