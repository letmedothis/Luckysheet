import { instanceSelector } from "./instance-dom";
import $ from "jquery";

export function ls$(selector: string, context?: string | Element | Document): JQuery {
  const instanceScoped = selector.replace(/#luckysheet-([a-zA-Z0-9_-]+)/g, (match, id) => {
    return instanceSelector(id);
  });
  
  if (context) {
    return $(instanceScoped, context);
  }
  return $(instanceScoped);
}

export function lsSelector(base: string): string {
  return instanceSelector(base);
}
