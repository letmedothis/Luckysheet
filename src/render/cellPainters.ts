// 自定义单元格渲染器注册表。
// 命中注册的 ct.t 类型时，由 painter 接管"内容层"绘制；
// 背景填充、角标(数据验证/批注/强制文本)、合并、边框仍由默认管线负责。

import type { CellObject } from "../store/types";

export interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CellPaintInfo extends CellRect {
  cell: CellObject;
  r: number;
  c: number;
}

export type CellPainter = (
  ctx: CanvasRenderingContext2D,
  info: CellPaintInfo
) => void;

const painters = new Map<string, CellPainter>();

// 内置类型受保护：直接覆盖会改变全表默认渲染管线，需显式 allowOverride
const BUILT_IN_TYPES = new Set(["n", "s", "d", "b", "p"]);

// paint(ctx, info): info = { cell, r, c, x, y, width, height }
// x/y 为格线起点(已含偏移)，width/height 为可视格尺寸
export function registerCellPainter(
  type: string,
  paint: CellPainter,
  options: { allowOverride?: boolean } = {}
): boolean {
  if (typeof type !== "string" || type === "" || typeof paint !== "function") {
    console.warn(
      "[luckysheet] registerCellPainter: invalid type or paint function"
    );
    return false;
  }
  if (BUILT_IN_TYPES.has(type) && !options.allowOverride) {
    console.warn(
      `[luckysheet] cell type "${type}" is built-in; pass { allowOverride: true } to override it`
    );
    return false;
  }
  painters.set(type, paint);
  return true;
}

export function unregisterCellPainter(type: string): boolean {
  return painters.delete(type);
}

export function hasCellPainter(cell?: CellObject | null): boolean {
  return cell != null && cell.ct != null && painters.has(cell.ct.t as string);
}

// cellRender 主管线调用：命中 painter 时完成内容绘制并返回 true
export function tryPaintCell(
  cell: CellObject | null | undefined,
  ctx: CanvasRenderingContext2D,
  rect: CellRect,
  r: number,
  c: number
): boolean {
  if (cell == null || cell.ct == null) {
    return false;
  }
  const painter = painters.get(cell.ct.t as string);
  if (painter == null) {
    return false;
  }
  painter(ctx, { cell, r, c, ...rect });
  return true;
}
