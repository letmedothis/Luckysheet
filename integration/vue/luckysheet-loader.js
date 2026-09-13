/**
 * Load Luckysheet from locally hosted dist assets.
 *
 * Expected directory layout (baseUrl points to the folder that contains dist):
 *
 *   <baseUrl>/plugins/css/pluginsCss.css
 *   <baseUrl>/plugins/plugins.css
 *   <baseUrl>/css/luckysheet.css
 *   <baseUrl>/assets/iconfont/iconfont.css
 *   <baseUrl>/plugins/js/plugin.js        // jQuery + 3rd party libs, must load first
 *   <baseUrl>/luckysheet.umd.js
 *
 * All assets are loaded once per page and cached. Load order is preserved:
 * plugin.js MUST be evaluated before luckysheet.umd.js.
 */

const ASSETS = [
  { type: "css", path: "plugins/css/pluginsCss.css" },
  { type: "css", path: "plugins/plugins.css" },
  { type: "css", path: "css/luckysheet.css" },
  { type: "css", path: "assets/iconfont/iconfont.css" },
  { type: "js", path: "plugins/js/plugin.js" },
  { type: "js", path: "luckysheet.umd.js" }
];

let loadingPromise = null;

function joinUrl(baseUrl, path) {
  return baseUrl.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

function injectCss(url) {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.setAttribute("data-luckysheet-asset", "1");
    link.onload = () => resolve();
    link.onerror = () =>
      reject(new Error("[luckysheet] failed to load stylesheet: " + url));
    document.head.appendChild(link);
  });
}

function injectScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = false; // keep execution order
    script.setAttribute("data-luckysheet-asset", "1");
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("[luckysheet] failed to load script: " + url));
    document.head.appendChild(script);
  });
}

function loadAsset(asset, baseUrl) {
  const url = joinUrl(baseUrl, asset.path);
  return asset.type === "css" ? injectCss(url) : injectScript(url);
}

/**
 * @param {string} baseUrl folder that contains the built Luckysheet assets
 * @returns {Promise<object>} the global `luckysheet` object
 */
export function loadLuckysheet(baseUrl = "/luckysheet/") {
  if (typeof window !== "undefined" && window.luckysheet) {
    return Promise.resolve(window.luckysheet);
  }
  if (loadingPromise) {
    return loadingPromise;
  }
  loadingPromise = ASSETS.reduce(
    (chain, asset) => chain.then(() => loadAsset(asset, baseUrl)),
    Promise.resolve()
  ).then(() => {
    if (!window.luckysheet) {
      loadingPromise = null;
      throw new Error(
        "[luckysheet] assets loaded but window.luckysheet is undefined"
      );
    }
    return window.luckysheet;
  });
  return loadingPromise;
}

/**
 * Whether the Luckysheet global has already been loaded.
 */
export function isLuckysheetLoaded() {
  return typeof window !== "undefined" && !!window.luckysheet;
}
