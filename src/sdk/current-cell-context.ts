import { getGlobalState } from "./index";

export interface CurrentCellContext {
  row: number | null;
  column: number | null;
  index: number | null;
  function: string | null;
}

export function getCurrentCellContext(): CurrentCellContext {
  const state = getGlobalState();
  return {
    row: state.luckysheetCurrentRow ?? null,
    column: state.luckysheetCurrentColumn ?? null,
    index: state.luckysheetCurrentIndex ?? null,
    function: state.luckysheetCurrentFunction ?? null,
  };
}

export function setCurrentCellContext(ctx: Partial<CurrentCellContext>): void {
  const state = getGlobalState();
  if (ctx.row !== undefined) state.luckysheetCurrentRow = ctx.row;
  if (ctx.column !== undefined) state.luckysheetCurrentColumn = ctx.column;
  if (ctx.index !== undefined) state.luckysheetCurrentIndex = ctx.index;
  if (ctx.function !== undefined) state.luckysheetCurrentFunction = ctx.function;
}
