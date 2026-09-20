import { getActiveStore } from "../store";
import { instanceSelector } from "./instance-dom";

let originalJQuery: ((selector: string, context?: any) => any) | null = null;
let patched = false;

export function getOriginalJQuery(): ((selector: string, context?: any) => any) | null {
  return originalJQuery;
}

export function isJQueryPatched(): boolean {
  return patched;
}

export function patchGlobalJQuery(): void {
  if (patched || typeof window === "undefined") {
    return;
  }

  const win = window as any;
  const jq = win.$ || win.jQuery;

  if (!jq || !jq.fn) {
    return;
  }

  originalJQuery = jq;

  const wrapped = function (selector: any, context?: any, ...rest: any[]) {
    if (typeof selector === "string" && selector.includes("#luckysheet-")) {
      const instanceScoped = selector.replace(/#luckysheet-([a-zA-Z0-9_-]+)/g, (match, id) => {
        return instanceSelector(id);
      });
      return originalJQuery!(instanceScoped, context, ...rest);
    }
    return originalJQuery!(selector, context, ...rest);
  };

  // Preserve jQuery prototype chain and static properties
  wrapped.fn = jq.fn;
  for (const key of Object.getOwnPropertyNames(jq)) {
    if (!(key in wrapped)) {
      try {
        (wrapped as any)[key] = (jq as any)[key];
      } catch {
        // ignore read-only properties
      }
    }
  }

  win.$ = wrapped;
  win.jQuery = wrapped;
  patched = true;
}

export function unpatchGlobalJQuery(): void {
  if (!patched || !originalJQuery || typeof window === "undefined") {
    return;
  }

  const win = window as any;
  win.$ = originalJQuery;
  win.jQuery = originalJQuery;
  patched = false;
  originalJQuery = null;
}
