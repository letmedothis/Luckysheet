(function (global) {
  "use strict";

  const state = {
    calls: [],
    listeners: new Map(),
    timers: new Map(),
    intervals: new Map(),
    mutationCount: 0,
  };

  function describeTarget(target) {
    if (target === global) return "window";
    if (target === document) return "document";
    if (target === document.body) return "body";
    if (target && target.id) return "#" + target.id;
    return target && target.nodeName
      ? target.nodeName.toLowerCase()
      : "unknown";
  }

  function absoluteUrl(value) {
    try {
      return new URL(String(value), document.baseURI).href;
    } catch (_error) {
      return String(value);
    }
  }

  function recordCall(kind, url, detail) {
    state.calls.push({
      kind,
      url: absoluteUrl(url),
      detail: detail || null,
      at: Math.round(performance.now()),
    });
  }

  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (this === global || this === document || this === document.body) {
      const key = describeTarget(this) + ":" + type;
      const entries = state.listeners.get(key) || [];
      entries.push({ listener, options });
      state.listeners.set(key, entries);
    }
    return originalAddEventListener.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function (
    type,
    listener,
    options
  ) {
    if (this === global || this === document || this === document.body) {
      const key = describeTarget(this) + ":" + type;
      const entries = state.listeners.get(key) || [];
      const index = entries.findIndex(function (entry) {
        return entry.listener === listener;
      });
      if (index >= 0) entries.splice(index, 1);
      state.listeners.set(key, entries);
    }
    return originalRemoveEventListener.call(this, type, listener, options);
  };

  const originalSetTimeout = global.setTimeout.bind(global);
  const originalClearTimeout = global.clearTimeout.bind(global);
  global.setTimeout = function (callback, delay) {
    let id;
    const wrapped = function () {
      state.timers.delete(id);
      if (typeof callback === "function")
        return callback.apply(this, arguments);
      return global.eval(callback);
    };
    id = originalSetTimeout(wrapped, delay);
    state.timers.set(id, {
      delay: Number(delay) || 0,
      stack: new Error().stack || "",
    });
    return id;
  };
  global.clearTimeout = function (id) {
    state.timers.delete(id);
    return originalClearTimeout(id);
  };

  const originalSetInterval = global.setInterval.bind(global);
  const originalClearInterval = global.clearInterval.bind(global);
  global.setInterval = function (callback, delay) {
    const id = originalSetInterval(callback, delay);
    state.intervals.set(id, {
      delay: Number(delay) || 0,
      stack: new Error().stack || "",
    });
    return id;
  };
  global.clearInterval = function (id) {
    state.intervals.delete(id);
    return originalClearInterval(id);
  };

  const originalFetch = global.fetch && global.fetch.bind(global);
  if (originalFetch) {
    global.fetch = function (input, init) {
      recordCall(
        "fetch",
        input && input.url ? input.url : input,
        init && init.method
      );
      return originalFetch(input, init);
    };
  }

  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__p101Request = { method: method, url: url };
    return originalXhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    const request = this.__p101Request || {};
    recordCall("xhr", request.url || "unknown", request.method || null);
    return originalXhrSend.apply(this, arguments);
  };

  const OriginalWebSocket = global.WebSocket;
  if (OriginalWebSocket) {
    global.WebSocket = function (url, protocols) {
      recordCall("websocket", url, null);
      return protocols === undefined
        ? new OriginalWebSocket(url)
        : new OriginalWebSocket(url, protocols);
    };
    global.WebSocket.prototype = OriginalWebSocket.prototype;
  }

  const observer = new MutationObserver(function (records) {
    state.mutationCount += records.length;
    records.forEach(function (record) {
      Array.prototype.forEach.call(record.addedNodes || [], function (node) {
        if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
        const url = node.src || node.href;
        if (url) recordCall("dom-resource", url, node.tagName);
      });
    });
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  function listenerSummary() {
    const result = {};
    state.listeners.forEach(function (entries, key) {
      if (entries.length) result[key] = entries.length;
    });
    return result;
  }

  function jqueryEventSummary(target) {
    if (!global.jQuery || !global.jQuery._data) return null;
    const events = global.jQuery._data(target, "events") || {};
    const result = {};
    Object.keys(events).forEach(function (type) {
      result[type] = events[type].map(function (handler) {
        return handler.namespace || "(none)";
      });
    });
    return result;
  }

  function activeTimers(map) {
    return Array.from(map.values()).map(function (timer) {
      const stackLine = timer.stack.split("\n").find(function (line) {
        return /luckysheet|baseline/i.test(line);
      });
      return {
        delay: timer.delay,
        source: stackLine ? stackLine.trim() : "unknown",
      };
    });
  }

  global.p101Instrumentation = {
    calls: state.calls,
    listenerSummary,
    jqueryEventSummary,
    activeTimers: function () {
      return {
        timeouts: activeTimers(state.timers),
        intervals: activeTimers(state.intervals),
      };
    },
    mutationCount: function () {
      return state.mutationCount;
    },
    resetMutationCount: function () {
      state.mutationCount = 0;
    },
  };
})(window);
