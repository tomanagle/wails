(() => {
  var __defProp = Object.defineProperty;
  var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
  var __export = (target, all) => {
    __markAsModule(target);
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // desktop/log.js
  var log_exports = {};
  __export(log_exports, {
    LogDebug: () => LogDebug,
    LogError: () => LogError,
    LogFatal: () => LogFatal,
    LogInfo: () => LogInfo,
    LogLevel: () => LogLevel,
    LogPrint: () => LogPrint,
    LogTrace: () => LogTrace,
    LogWarning: () => LogWarning,
    SetLogLevel: () => SetLogLevel
  });
  function sendLogMessage(level, message) {
    window.WailsInvoke("L" + level + message);
  }
  function LogTrace(message) {
    sendLogMessage("T", message);
  }
  function LogPrint(message) {
    sendLogMessage("P", message);
  }
  function LogDebug(message) {
    sendLogMessage("D", message);
  }
  function LogInfo(message) {
    sendLogMessage("I", message);
  }
  function LogWarning(message) {
    sendLogMessage("W", message);
  }
  function LogError(message) {
    sendLogMessage("E", message);
  }
  function LogFatal(message) {
    sendLogMessage("F", message);
  }
  function SetLogLevel(loglevel) {
    sendLogMessage("S", loglevel);
  }
  var LogLevel = {
    TRACE: 1,
    DEBUG: 2,
    INFO: 3,
    WARNING: 4,
    ERROR: 5
  };

  // desktop/events.js
  var Listener = class {
    constructor(callback, maxCallbacks) {
      maxCallbacks = maxCallbacks || -1;
      this.Callback = (data) => {
        callback.apply(null, data);
        if (maxCallbacks === -1) {
          return false;
        }
        maxCallbacks -= 1;
        return maxCallbacks === 0;
      };
    }
  };
  var eventListeners = {};
  function EventsOnMultiple(eventName, callback, maxCallbacks) {
    eventListeners[eventName] = eventListeners[eventName] || [];
    const thisListener = new Listener(callback, maxCallbacks);
    eventListeners[eventName].push(thisListener);
  }
  function EventsOn(eventName, callback) {
    EventsOnMultiple(eventName, callback, -1);
  }
  function EventsOnce(eventName, callback) {
    EventsOnMultiple(eventName, callback, 1);
  }
  function notifyListeners(eventData) {
    let eventName = eventData.name;
    if (eventListeners[eventName]) {
      const newEventListenerList = eventListeners[eventName].slice();
      for (let count = 0; count < eventListeners[eventName].length; count += 1) {
        const listener = eventListeners[eventName][count];
        let data = eventData.data;
        const destroy = listener.Callback(data);
        if (destroy) {
          newEventListenerList.splice(count, 1);
        }
      }
      eventListeners[eventName] = newEventListenerList;
    }
  }
  function EventsNotify(notifyMessage) {
    let message;
    try {
      message = JSON.parse(notifyMessage);
    } catch (e) {
      const error = "Invalid JSON passed to Notify: " + notifyMessage;
      throw new Error(error);
    }
    notifyListeners(message);
  }
  function EventsEmit(eventName) {
    const payload = {
      name: eventName,
      data: [].slice.apply(arguments).slice(1)
    };
    notifyListeners(payload);
    window.WailsInvoke("EE" + JSON.stringify(payload));
  }
  function EventsOff(eventName) {
    delete eventListeners[eventName];
    window.WailsInvoke("EX" + eventName);
  }

  // desktop/calls.js
  var callbacks = {};
  function cryptoRandom() {
    var array = new Uint32Array(1);
    return window.crypto.getRandomValues(array)[0];
  }
  function basicRandom() {
    return Math.random() * 9007199254740991;
  }
  var randomFunc;
  if (window.crypto) {
    randomFunc = cryptoRandom;
  } else {
    randomFunc = basicRandom;
  }
  function Call(name, args, timeout) {
    if (timeout == null) {
      timeout = 0;
    }
    return new Promise(function(resolve, reject) {
      var callbackID;
      do {
        callbackID = name + "-" + randomFunc();
      } while (callbacks[callbackID]);
      var timeoutHandle;
      if (timeout > 0) {
        timeoutHandle = setTimeout(function() {
          reject(Error("Call to " + name + " timed out. Request ID: " + callbackID));
        }, timeout);
      }
      callbacks[callbackID] = {
        timeoutHandle,
        reject,
        resolve
      };
      try {
        const payload = {
          name,
          args,
          callbackID
        };
        window.WailsInvoke("C" + JSON.stringify(payload));
      } catch (e) {
        console.error(e);
      }
    });
  }
  function Callback(incomingMessage) {
    let message;
    try {
      message = JSON.parse(incomingMessage);
    } catch (e) {
      const error = `Invalid JSON passed to callback: ${e.message}. Message: ${incomingMessage}`;
      runtime.LogDebug(error);
      throw new Error(error);
    }
    let callbackID = message.callbackid;
    let callbackData = callbacks[callbackID];
    if (!callbackData) {
      const error = `Callback '${callbackID}' not registered!!!`;
      console.error(error);
      throw new Error(error);
    }
    clearTimeout(callbackData.timeoutHandle);
    delete callbacks[callbackID];
    if (message.error) {
      callbackData.reject(message.error);
    } else {
      callbackData.resolve(message.result);
    }
  }

  // desktop/bindings.js
  window.go = {};
  function SetBindings(bindingsMap) {
    try {
      bindingsMap = JSON.parse(bindingsMap);
    } catch (e) {
      console.error(e);
    }
    window.go = window.go || {};
    Object.keys(bindingsMap).forEach((packageName) => {
      window.go[packageName] = window.go[packageName] || {};
      Object.keys(bindingsMap[packageName]).forEach((structName) => {
        window.go[packageName][structName] = window.go[packageName][structName] || {};
        Object.keys(bindingsMap[packageName][structName]).forEach((methodName) => {
          window.go[packageName][structName][methodName] = function() {
            let timeout = 0;
            function dynamic() {
              const args = [].slice.call(arguments);
              return Call([packageName, structName, methodName].join("."), args, timeout);
            }
            dynamic.setTimeout = function(newTimeout) {
              timeout = newTimeout;
            };
            dynamic.getTimeout = function() {
              return timeout;
            };
            return dynamic;
          }();
        });
      });
    });
  }

  // desktop/window.js
  var window_exports = {};
  __export(window_exports, {
    WindowCenter: () => WindowCenter,
    WindowFullscreen: () => WindowFullscreen,
    WindowGetPosition: () => WindowGetPosition,
    WindowGetSize: () => WindowGetSize,
    WindowHide: () => WindowHide,
    WindowMaximise: () => WindowMaximise,
    WindowMinimise: () => WindowMinimise,
    WindowReload: () => WindowReload,
    WindowReloadApp: () => WindowReloadApp,
    WindowSetDarkTheme: () => WindowSetDarkTheme,
    WindowSetLightTheme: () => WindowSetLightTheme,
    WindowSetMaxSize: () => WindowSetMaxSize,
    WindowSetMinSize: () => WindowSetMinSize,
    WindowSetPosition: () => WindowSetPosition,
    WindowSetRGBA: () => WindowSetRGBA,
    WindowSetSize: () => WindowSetSize,
    WindowSetSystemDefaultTheme: () => WindowSetSystemDefaultTheme,
    WindowSetTitle: () => WindowSetTitle,
    WindowShow: () => WindowShow,
    WindowToggleMaximise: () => WindowToggleMaximise,
    WindowUnfullscreen: () => WindowUnfullscreen,
    WindowUnmaximise: () => WindowUnmaximise,
    WindowUnminimise: () => WindowUnminimise
  });
  function WindowReload() {
    window.location.reload();
  }
  function WindowReloadApp() {
    window.WailsInvoke("WR");
  }
  function WindowSetSystemDefaultTheme() {
    window.WailsInvoke("WASDT");
  }
  function WindowSetLightTheme() {
    window.WailsInvoke("WALT");
  }
  function WindowSetDarkTheme() {
    window.WailsInvoke("WADT");
  }
  function WindowCenter() {
    window.WailsInvoke("Wc");
  }
  function WindowSetTitle(title) {
    window.WailsInvoke("WT" + title);
  }
  function WindowFullscreen() {
    window.WailsInvoke("WF");
  }
  function WindowUnfullscreen() {
    window.WailsInvoke("Wf");
  }
  function WindowSetSize(width, height) {
    window.WailsInvoke("Ws:" + width + ":" + height);
  }
  function WindowGetSize() {
    return Call(":wails:WindowGetSize");
  }
  function WindowSetMaxSize(width, height) {
    window.WailsInvoke("WZ:" + width + ":" + height);
  }
  function WindowSetMinSize(width, height) {
    window.WailsInvoke("Wz:" + width + ":" + height);
  }
  function WindowSetPosition(x, y) {
    window.WailsInvoke("Wp:" + x + ":" + y);
  }
  function WindowGetPosition() {
    return Call(":wails:WindowGetPos");
  }
  function WindowHide() {
    window.WailsInvoke("WH");
  }
  function WindowShow() {
    window.WailsInvoke("WS");
  }
  function WindowMaximise() {
    window.WailsInvoke("WM");
  }
  function WindowToggleMaximise() {
    window.WailsInvoke("Wt");
  }
  function WindowUnmaximise() {
    window.WailsInvoke("WU");
  }
  function WindowMinimise() {
    window.WailsInvoke("Wm");
  }
  function WindowUnminimise() {
    window.WailsInvoke("Wu");
  }
  function WindowSetRGBA(R, G, B, A) {
    let rgba = JSON.stringify({r: R || 0, g: G || 0, b: B || 0, a: A || 255});
    window.WailsInvoke("Wr:" + rgba);
  }

  // desktop/browser.js
  var browser_exports = {};
  __export(browser_exports, {
    BrowserOpenURL: () => BrowserOpenURL
  });
  function BrowserOpenURL(url) {
    window.WailsInvoke("BO:" + url);
  }

  // desktop/cache.js
  var cache_exports = {};
  __export(cache_exports, {
    CacheDelete: () => CacheDelete,
    CacheGet: () => CacheGet,
    CacheSet: () => CacheSet
  });
  var CacheEntry = class {
    constructor(data, mimetype) {
      this.data = data || new ArrayBuffer(0);
      this.mimetype = mimetype;
    }
    toString() {
      const arr = new Uint8Array(this.data);
      return new TextDecoder().decode(arr);
    }
    tojSON() {
      const str = this.toString();
      return JSON.parse(str);
    }
    toObjectURL() {
      return URL.createObjectURL(new Blob([this.data]));
    }
  };
  function CacheGet(key) {
    return new Promise(function (resolve, reject) {
      fetch("/cache/" + key).then((res) => {
        if (!res.ok) {
          return resolve(new CacheEntry());
        }
        let mimetype = res.headers.get("content-type");
        res.arrayBuffer().then((buffer) => {
          EventsEmit("wails:cache:get", key);
          return resolve(new CacheEntry(buffer, mimetype));
        }).catch((err) => {
          return reject(err);
        });
      }).catch((err) => {
        return reject(err);
      });
    });
  }
  function CacheSet(key, data) {
    return new Promise(function (resolve, reject) {
      let convertedData = data;
      if (typeof data === "object") {
        try {
          convertedData = JSON.stringify(data);
        } catch (e) {
        }
      }
      fetch("/cache/" + key, {
        method: "PUT",
        body: convertedData
      }).then((res) => {
        if (!res.ok) {
          return reject();
        }
        EventsEmit("wails:cache:set", key);
        return resolve();
      }).catch((err) => {
        return reject(err);
      });
    });
  }
  function CacheDelete(key) {
    return new Promise(function (resolve, reject) {
      fetch("/cache/" + key, {
        method: "DELETE"
      }).then((res) => {
        if (!res.ok) {
          return reject();
        }
        EventsEmit("wails:cache:delete", key);
        return resolve();
      }).catch((err) => {
        return reject(err);
      });
    });
  }

  // desktop/main.js
  function Quit() {
    window.WailsInvoke("Q");
  }
  function Environment() {
    return Call(":wails:Environment");
  }
  window.runtime = {
    ...log_exports,
    ...window_exports,
    ...browser_exports,
    ...cache_exports,
    EventsOn,
    EventsOnce,
    EventsOnMultiple,
    EventsEmit,
    EventsOff,
    Environment,
    Quit
  };
  window.wails = {
    Callback,
    EventsNotify,
    SetBindings,
    eventListeners,
    callbacks,
    flags: {
      disableScrollbarDrag: false,
      disableWailsDefaultContextMenu: false,
      enableResize: false,
      defaultCursor: null,
      borderThickness: 6,
      dbClickInterval: 100
    }
  };
  window.wails.SetBindings(window.wailsbindings);
  delete window.wails.SetBindings;
  if (true) {
    delete window.wailsbindings;
  }
  var dragTimeOut;
  var dragLastTime = 0;
  function drag() {
    window.WailsInvoke("drag");
  }
  window.addEventListener("mousedown", (e) => {
    if (window.wails.flags.resizeEdge) {
      window.WailsInvoke("resize:" + window.wails.flags.resizeEdge);
      e.preventDefault();
      return;
    }
    let currentElement = e.target;
    while (currentElement != null) {
      if (currentElement.hasAttribute("data-wails-no-drag")) {
        break;
      } else if (currentElement.hasAttribute("data-wails-drag")) {
        if (window.wails.flags.disableScrollbarDrag) {
          if (e.offsetX > e.target.clientWidth || e.offsetY > e.target.clientHeight) {
            break;
          }
        }
        if (new Date().getTime() - dragLastTime < window.wails.flags.dbClickInterval) {
          clearTimeout(dragTimeOut);
          break;
        }
        dragTimeOut = setTimeout(drag, window.wails.flags.dbClickInterval);
        dragLastTime = new Date().getTime();
        e.preventDefault();
        break;
      }
      currentElement = currentElement.parentElement;
    }
  });
  function setResize(cursor) {
    document.body.style.cursor = cursor || window.wails.flags.defaultCursor;
    window.wails.flags.resizeEdge = cursor;
  }
  window.addEventListener("mousemove", function(e) {
    if (!window.wails.flags.enableResize) {
      return;
    }
    if (window.wails.flags.defaultCursor == null) {
      window.wails.flags.defaultCursor = document.body.style.cursor;
    }
    if (window.outerWidth - e.clientX < window.wails.flags.borderThickness && window.outerHeight - e.clientY < window.wails.flags.borderThickness) {
      document.body.style.cursor = "se-resize";
    }
    let rightBorder = window.outerWidth - e.clientX < window.wails.flags.borderThickness;
    let leftBorder = e.clientX < window.wails.flags.borderThickness;
    let topBorder = e.clientY < window.wails.flags.borderThickness;
    let bottomBorder = window.outerHeight - e.clientY < window.wails.flags.borderThickness;
    if (!leftBorder && !rightBorder && !topBorder && !bottomBorder && window.wails.flags.resizeEdge !== void 0) {
      setResize();
    } else if (rightBorder && bottomBorder)
      setResize("se-resize");
    else if (leftBorder && bottomBorder)
      setResize("sw-resize");
    else if (leftBorder && topBorder)
      setResize("nw-resize");
    else if (topBorder && rightBorder)
      setResize("ne-resize");
    else if (leftBorder)
      setResize("w-resize");
    else if (topBorder)
      setResize("n-resize");
    else if (bottomBorder)
      setResize("s-resize");
    else if (rightBorder)
      setResize("e-resize");
  });
  window.addEventListener("contextmenu", function(e) {
    if (window.wails.flags.disableWailsDefaultContextMenu) {
      e.preventDefault();
    }
  });
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiZGVza3RvcC9sb2cuanMiLCAiZGVza3RvcC9ldmVudHMuanMiLCAiZGVza3RvcC9jYWxscy5qcyIsICJkZXNrdG9wL2JpbmRpbmdzLmpzIiwgImRlc2t0b3Avd2luZG93LmpzIiwgImRlc2t0b3AvYnJvd3Nlci5qcyIsICJkZXNrdG9wL2NhY2hlLmpzIiwgImRlc2t0b3AvbWFpbi5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLypcclxuIF8gICAgICAgX18gICAgICBfIF9fXHJcbnwgfCAgICAgLyAvX19fIF8oXykgL19fX19cclxufCB8IC98IC8gLyBfXyBgLyAvIC8gX19fL1xyXG58IHwvIHwvIC8gL18vIC8gLyAoX18gIClcclxufF9fL3xfXy9cXF9fLF8vXy9fL19fX18vXHJcblRoZSBlbGVjdHJvbiBhbHRlcm5hdGl2ZSBmb3IgR29cclxuKGMpIExlYSBBbnRob255IDIwMTktcHJlc2VudFxyXG4qL1xyXG5cclxuLyoganNoaW50IGVzdmVyc2lvbjogNiAqL1xyXG5cclxuLyoqXHJcbiAqIFNlbmRzIGEgbG9nIG1lc3NhZ2UgdG8gdGhlIGJhY2tlbmQgd2l0aCB0aGUgZ2l2ZW4gbGV2ZWwgKyBtZXNzYWdlXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBsZXZlbFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZVxyXG4gKi9cclxuZnVuY3Rpb24gc2VuZExvZ01lc3NhZ2UobGV2ZWwsIG1lc3NhZ2UpIHtcclxuXHJcblx0Ly8gTG9nIE1lc3NhZ2UgZm9ybWF0OlxyXG5cdC8vIGxbdHlwZV1bbWVzc2FnZV1cclxuXHR3aW5kb3cuV2FpbHNJbnZva2UoJ0wnICsgbGV2ZWwgKyBtZXNzYWdlKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIExvZyB0aGUgZ2l2ZW4gdHJhY2UgbWVzc2FnZSB3aXRoIHRoZSBiYWNrZW5kXHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2VcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBMb2dUcmFjZShtZXNzYWdlKSB7XHJcblx0c2VuZExvZ01lc3NhZ2UoJ1QnLCBtZXNzYWdlKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIExvZyB0aGUgZ2l2ZW4gbWVzc2FnZSB3aXRoIHRoZSBiYWNrZW5kXHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2VcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBMb2dQcmludChtZXNzYWdlKSB7XHJcblx0c2VuZExvZ01lc3NhZ2UoJ1AnLCBtZXNzYWdlKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIExvZyB0aGUgZ2l2ZW4gZGVidWcgbWVzc2FnZSB3aXRoIHRoZSBiYWNrZW5kXHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2VcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBMb2dEZWJ1ZyhtZXNzYWdlKSB7XHJcblx0c2VuZExvZ01lc3NhZ2UoJ0QnLCBtZXNzYWdlKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIExvZyB0aGUgZ2l2ZW4gaW5mbyBtZXNzYWdlIHdpdGggdGhlIGJhY2tlbmRcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIExvZ0luZm8obWVzc2FnZSkge1xyXG5cdHNlbmRMb2dNZXNzYWdlKCdJJywgbWVzc2FnZSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBMb2cgdGhlIGdpdmVuIHdhcm5pbmcgbWVzc2FnZSB3aXRoIHRoZSBiYWNrZW5kXHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHBhcmFtIHtzdHJpbmd9IG1lc3NhZ2VcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBMb2dXYXJuaW5nKG1lc3NhZ2UpIHtcclxuXHRzZW5kTG9nTWVzc2FnZSgnVycsIG1lc3NhZ2UpO1xyXG59XHJcblxyXG4vKipcclxuICogTG9nIHRoZSBnaXZlbiBlcnJvciBtZXNzYWdlIHdpdGggdGhlIGJhY2tlbmRcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIExvZ0Vycm9yKG1lc3NhZ2UpIHtcclxuXHRzZW5kTG9nTWVzc2FnZSgnRScsIG1lc3NhZ2UpO1xyXG59XHJcblxyXG4vKipcclxuICogTG9nIHRoZSBnaXZlbiBmYXRhbCBtZXNzYWdlIHdpdGggdGhlIGJhY2tlbmRcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIExvZ0ZhdGFsKG1lc3NhZ2UpIHtcclxuXHRzZW5kTG9nTWVzc2FnZSgnRicsIG1lc3NhZ2UpO1xyXG59XHJcblxyXG4vKipcclxuICogU2V0cyB0aGUgTG9nIGxldmVsIHRvIHRoZSBnaXZlbiBsb2cgbGV2ZWxcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge251bWJlcn0gbG9nbGV2ZWxcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBTZXRMb2dMZXZlbChsb2dsZXZlbCkge1xyXG5cdHNlbmRMb2dNZXNzYWdlKCdTJywgbG9nbGV2ZWwpO1xyXG59XHJcblxyXG4vLyBMb2cgbGV2ZWxzXHJcbmV4cG9ydCBjb25zdCBMb2dMZXZlbCA9IHtcclxuXHRUUkFDRTogMSxcclxuXHRERUJVRzogMixcclxuXHRJTkZPOiAzLFxyXG5cdFdBUk5JTkc6IDQsXHJcblx0RVJST1I6IDUsXHJcbn07XHJcbiIsICIvKlxyXG4gXyAgICAgICBfXyAgICAgIF8gX19cclxufCB8ICAgICAvIC9fX18gXyhfKSAvX19fX1xyXG58IHwgL3wgLyAvIF9fIGAvIC8gLyBfX18vXHJcbnwgfC8gfC8gLyAvXy8gLyAvIChfXyAgKVxyXG58X18vfF9fL1xcX18sXy9fL18vX19fXy9cclxuVGhlIGVsZWN0cm9uIGFsdGVybmF0aXZlIGZvciBHb1xyXG4oYykgTGVhIEFudGhvbnkgMjAxOS1wcmVzZW50XHJcbiovXHJcbi8qIGpzaGludCBlc3ZlcnNpb246IDYgKi9cclxuXHJcbi8vIERlZmluZXMgYSBzaW5nbGUgbGlzdGVuZXIgd2l0aCBhIG1heGltdW0gbnVtYmVyIG9mIHRpbWVzIHRvIGNhbGxiYWNrXHJcblxyXG4vKipcclxuICogVGhlIExpc3RlbmVyIGNsYXNzIGRlZmluZXMgYSBsaXN0ZW5lciEgOi0pXHJcbiAqXHJcbiAqIEBjbGFzcyBMaXN0ZW5lclxyXG4gKi9cclxuY2xhc3MgTGlzdGVuZXIge1xyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGFuIGluc3RhbmNlIG9mIExpc3RlbmVyLlxyXG4gICAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2tcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXhDYWxsYmFja3NcclxuICAgICAqIEBtZW1iZXJvZiBMaXN0ZW5lclxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihjYWxsYmFjaywgbWF4Q2FsbGJhY2tzKSB7XHJcbiAgICAgICAgLy8gRGVmYXVsdCBvZiAtMSBtZWFucyBpbmZpbml0ZVxyXG4gICAgICAgIG1heENhbGxiYWNrcyA9IG1heENhbGxiYWNrcyB8fCAtMTtcclxuICAgICAgICAvLyBDYWxsYmFjayBpbnZva2VzIHRoZSBjYWxsYmFjayB3aXRoIHRoZSBnaXZlbiBkYXRhXHJcbiAgICAgICAgLy8gUmV0dXJucyB0cnVlIGlmIHRoaXMgbGlzdGVuZXIgc2hvdWxkIGJlIGRlc3Ryb3llZFxyXG4gICAgICAgIHRoaXMuQ2FsbGJhY2sgPSAoZGF0YSkgPT4ge1xyXG4gICAgICAgICAgICBjYWxsYmFjay5hcHBseShudWxsLCBkYXRhKTtcclxuICAgICAgICAgICAgLy8gSWYgbWF4Q2FsbGJhY2tzIGlzIGluZmluaXRlLCByZXR1cm4gZmFsc2UgKGRvIG5vdCBkZXN0cm95KVxyXG4gICAgICAgICAgICBpZiAobWF4Q2FsbGJhY2tzID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIERlY3JlbWVudCBtYXhDYWxsYmFja3MuIFJldHVybiB0cnVlIGlmIG5vdyAwLCBvdGhlcndpc2UgZmFsc2VcclxuICAgICAgICAgICAgbWF4Q2FsbGJhY2tzIC09IDE7XHJcbiAgICAgICAgICAgIHJldHVybiBtYXhDYWxsYmFja3MgPT09IDA7XHJcbiAgICAgICAgfTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IGV2ZW50TGlzdGVuZXJzID0ge307XHJcblxyXG4vKipcclxuICogUmVnaXN0ZXJzIGFuIGV2ZW50IGxpc3RlbmVyIHRoYXQgd2lsbCBiZSBpbnZva2VkIGBtYXhDYWxsYmFja3NgIHRpbWVzIGJlZm9yZSBiZWluZyBkZXN0cm95ZWRcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lXHJcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBtYXhDYWxsYmFja3NcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBFdmVudHNPbk11bHRpcGxlKGV2ZW50TmFtZSwgY2FsbGJhY2ssIG1heENhbGxiYWNrcykge1xyXG4gICAgZXZlbnRMaXN0ZW5lcnNbZXZlbnROYW1lXSA9IGV2ZW50TGlzdGVuZXJzW2V2ZW50TmFtZV0gfHwgW107XHJcbiAgICBjb25zdCB0aGlzTGlzdGVuZXIgPSBuZXcgTGlzdGVuZXIoY2FsbGJhY2ssIG1heENhbGxiYWNrcyk7XHJcbiAgICBldmVudExpc3RlbmVyc1tldmVudE5hbWVdLnB1c2godGhpc0xpc3RlbmVyKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlZ2lzdGVycyBhbiBldmVudCBsaXN0ZW5lciB0aGF0IHdpbGwgYmUgaW52b2tlZCBldmVyeSB0aW1lIHRoZSBldmVudCBpcyBlbWl0dGVkXHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50TmFtZVxyXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIEV2ZW50c09uKGV2ZW50TmFtZSwgY2FsbGJhY2spIHtcclxuICAgIEV2ZW50c09uTXVsdGlwbGUoZXZlbnROYW1lLCBjYWxsYmFjaywgLTEpO1xyXG59XHJcblxyXG4vKipcclxuICogUmVnaXN0ZXJzIGFuIGV2ZW50IGxpc3RlbmVyIHRoYXQgd2lsbCBiZSBpbnZva2VkIG9uY2UgdGhlbiBkZXN0cm95ZWRcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gZXZlbnROYW1lXHJcbiAqIEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gRXZlbnRzT25jZShldmVudE5hbWUsIGNhbGxiYWNrKSB7XHJcbiAgICBFdmVudHNPbk11bHRpcGxlKGV2ZW50TmFtZSwgY2FsbGJhY2ssIDEpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBub3RpZnlMaXN0ZW5lcnMoZXZlbnREYXRhKSB7XHJcblxyXG4gICAgLy8gR2V0IHRoZSBldmVudCBuYW1lXHJcbiAgICBsZXQgZXZlbnROYW1lID0gZXZlbnREYXRhLm5hbWU7XHJcblxyXG4gICAgLy8gQ2hlY2sgaWYgd2UgaGF2ZSBhbnkgbGlzdGVuZXJzIGZvciB0aGlzIGV2ZW50XHJcbiAgICBpZiAoZXZlbnRMaXN0ZW5lcnNbZXZlbnROYW1lXSkge1xyXG5cclxuICAgICAgICAvLyBLZWVwIGEgbGlzdCBvZiBsaXN0ZW5lciBpbmRleGVzIHRvIGRlc3Ryb3lcclxuICAgICAgICBjb25zdCBuZXdFdmVudExpc3RlbmVyTGlzdCA9IGV2ZW50TGlzdGVuZXJzW2V2ZW50TmFtZV0uc2xpY2UoKTtcclxuXHJcbiAgICAgICAgLy8gSXRlcmF0ZSBsaXN0ZW5lcnNcclxuICAgICAgICBmb3IgKGxldCBjb3VudCA9IDA7IGNvdW50IDwgZXZlbnRMaXN0ZW5lcnNbZXZlbnROYW1lXS5sZW5ndGg7IGNvdW50ICs9IDEpIHtcclxuXHJcbiAgICAgICAgICAgIC8vIEdldCBuZXh0IGxpc3RlbmVyXHJcbiAgICAgICAgICAgIGNvbnN0IGxpc3RlbmVyID0gZXZlbnRMaXN0ZW5lcnNbZXZlbnROYW1lXVtjb3VudF07XHJcblxyXG4gICAgICAgICAgICBsZXQgZGF0YSA9IGV2ZW50RGF0YS5kYXRhO1xyXG5cclxuICAgICAgICAgICAgLy8gRG8gdGhlIGNhbGxiYWNrXHJcbiAgICAgICAgICAgIGNvbnN0IGRlc3Ryb3kgPSBsaXN0ZW5lci5DYWxsYmFjayhkYXRhKTtcclxuICAgICAgICAgICAgaWYgKGRlc3Ryb3kpIHtcclxuICAgICAgICAgICAgICAgIC8vIGlmIHRoZSBsaXN0ZW5lciBpbmRpY2F0ZWQgdG8gZGVzdHJveSBpdHNlbGYsIGFkZCBpdCB0byB0aGUgZGVzdHJveSBsaXN0XHJcbiAgICAgICAgICAgICAgICBuZXdFdmVudExpc3RlbmVyTGlzdC5zcGxpY2UoY291bnQsIDEpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBVcGRhdGUgY2FsbGJhY2tzIHdpdGggbmV3IGxpc3Qgb2YgbGlzdGVuZXJzXHJcbiAgICAgICAgZXZlbnRMaXN0ZW5lcnNbZXZlbnROYW1lXSA9IG5ld0V2ZW50TGlzdGVuZXJMaXN0O1xyXG4gICAgfVxyXG59XHJcblxyXG4vKipcclxuICogTm90aWZ5IGluZm9ybXMgZnJvbnRlbmQgbGlzdGVuZXJzIHRoYXQgYW4gZXZlbnQgd2FzIGVtaXR0ZWQgd2l0aCB0aGUgZ2l2ZW4gZGF0YVxyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBub3RpZnlNZXNzYWdlIC0gZW5jb2RlZCBub3RpZmljYXRpb24gbWVzc2FnZVxyXG5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBFdmVudHNOb3RpZnkobm90aWZ5TWVzc2FnZSkge1xyXG4gICAgLy8gUGFyc2UgdGhlIG1lc3NhZ2VcclxuICAgIGxldCBtZXNzYWdlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICBtZXNzYWdlID0gSlNPTi5wYXJzZShub3RpZnlNZXNzYWdlKTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICBjb25zdCBlcnJvciA9ICdJbnZhbGlkIEpTT04gcGFzc2VkIHRvIE5vdGlmeTogJyArIG5vdGlmeU1lc3NhZ2U7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9yKTtcclxuICAgIH1cclxuICAgIG5vdGlmeUxpc3RlbmVycyhtZXNzYWdlKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEVtaXQgYW4gZXZlbnQgd2l0aCB0aGUgZ2l2ZW4gbmFtZSBhbmQgZGF0YVxyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBldmVudE5hbWVcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBFdmVudHNFbWl0KGV2ZW50TmFtZSkge1xyXG5cclxuICAgIGNvbnN0IHBheWxvYWQgPSB7XHJcbiAgICAgICAgbmFtZTogZXZlbnROYW1lLFxyXG4gICAgICAgIGRhdGE6IFtdLnNsaWNlLmFwcGx5KGFyZ3VtZW50cykuc2xpY2UoMSksXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIE5vdGlmeSBKUyBsaXN0ZW5lcnNcclxuICAgIG5vdGlmeUxpc3RlbmVycyhwYXlsb2FkKTtcclxuXHJcbiAgICAvLyBOb3RpZnkgR28gbGlzdGVuZXJzXHJcbiAgICB3aW5kb3cuV2FpbHNJbnZva2UoJ0VFJyArIEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIEV2ZW50c09mZihldmVudE5hbWUpIHtcclxuICAgIC8vIFJlbW92ZSBsb2NhbCBsaXN0ZW5lcnNcclxuICAgIGRlbGV0ZSBldmVudExpc3RlbmVyc1tldmVudE5hbWVdO1xyXG5cclxuICAgIC8vIE5vdGlmeSBHbyBsaXN0ZW5lcnNcclxuICAgIHdpbmRvdy5XYWlsc0ludm9rZSgnRVgnICsgZXZlbnROYW1lKTtcclxufSIsICIvKlxyXG4gXyAgICAgICBfXyAgICAgIF8gX19cclxufCB8ICAgICAvIC9fX18gXyhfKSAvX19fX1xyXG58IHwgL3wgLyAvIF9fIGAvIC8gLyBfX18vXHJcbnwgfC8gfC8gLyAvXy8gLyAvIChfXyAgKVxyXG58X18vfF9fL1xcX18sXy9fL18vX19fXy9cclxuVGhlIGVsZWN0cm9uIGFsdGVybmF0aXZlIGZvciBHb1xyXG4oYykgTGVhIEFudGhvbnkgMjAxOS1wcmVzZW50XHJcbiovXHJcbi8qIGpzaGludCBlc3ZlcnNpb246IDYgKi9cclxuXHJcbmV4cG9ydCBjb25zdCBjYWxsYmFja3MgPSB7fTtcclxuXHJcbi8qKlxyXG4gKiBSZXR1cm5zIGEgbnVtYmVyIGZyb20gdGhlIG5hdGl2ZSBicm93c2VyIHJhbmRvbSBmdW5jdGlvblxyXG4gKlxyXG4gKiBAcmV0dXJucyBudW1iZXJcclxuICovXHJcbmZ1bmN0aW9uIGNyeXB0b1JhbmRvbSgpIHtcclxuXHR2YXIgYXJyYXkgPSBuZXcgVWludDMyQXJyYXkoMSk7XHJcblx0cmV0dXJuIHdpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKGFycmF5KVswXTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJldHVybnMgYSBudW1iZXIgdXNpbmcgZGEgb2xkLXNrb29sIE1hdGguUmFuZG9tXHJcbiAqIEkgbGlrZXMgdG8gY2FsbCBpdCBMT0xSYW5kb21cclxuICpcclxuICogQHJldHVybnMgbnVtYmVyXHJcbiAqL1xyXG5mdW5jdGlvbiBiYXNpY1JhbmRvbSgpIHtcclxuXHRyZXR1cm4gTWF0aC5yYW5kb20oKSAqIDkwMDcxOTkyNTQ3NDA5OTE7XHJcbn1cclxuXHJcbi8vIFBpY2sgYSByYW5kb20gbnVtYmVyIGZ1bmN0aW9uIGJhc2VkIG9uIGJyb3dzZXIgY2FwYWJpbGl0eVxyXG52YXIgcmFuZG9tRnVuYztcclxuaWYgKHdpbmRvdy5jcnlwdG8pIHtcclxuXHRyYW5kb21GdW5jID0gY3J5cHRvUmFuZG9tO1xyXG59IGVsc2Uge1xyXG5cdHJhbmRvbUZ1bmMgPSBiYXNpY1JhbmRvbTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBDYWxsIHNlbmRzIGEgbWVzc2FnZSB0byB0aGUgYmFja2VuZCB0byBjYWxsIHRoZSBiaW5kaW5nIHdpdGggdGhlXHJcbiAqIGdpdmVuIGRhdGEuIEEgcHJvbWlzZSBpcyByZXR1cm5lZCBhbmQgd2lsbCBiZSBjb21wbGV0ZWQgd2hlbiB0aGVcclxuICogYmFja2VuZCByZXNwb25kcy4gVGhpcyB3aWxsIGJlIHJlc29sdmVkIHdoZW4gdGhlIGNhbGwgd2FzIHN1Y2Nlc3NmdWxcclxuICogb3IgcmVqZWN0ZWQgaWYgYW4gZXJyb3IgaXMgcGFzc2VkIGJhY2suXHJcbiAqIFRoZXJlIGlzIGEgdGltZW91dCBtZWNoYW5pc20uIElmIHRoZSBjYWxsIGRvZXNuJ3QgcmVzcG9uZCBpbiB0aGUgZ2l2ZW5cclxuICogdGltZSAoaW4gbWlsbGlzZWNvbmRzKSB0aGVuIHRoZSBwcm9taXNlIGlzIHJlamVjdGVkLlxyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lXHJcbiAqIEBwYXJhbSB7YW55PX0gYXJnc1xyXG4gKiBAcGFyYW0ge251bWJlcj19IHRpbWVvdXRcclxuICogQHJldHVybnNcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBDYWxsKG5hbWUsIGFyZ3MsIHRpbWVvdXQpIHtcclxuXHJcblx0Ly8gVGltZW91dCBpbmZpbml0ZSBieSBkZWZhdWx0XHJcblx0aWYgKHRpbWVvdXQgPT0gbnVsbCkge1xyXG5cdFx0dGltZW91dCA9IDA7XHJcblx0fVxyXG5cclxuXHQvLyBDcmVhdGUgYSBwcm9taXNlXHJcblx0cmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuXHJcblx0XHQvLyBDcmVhdGUgYSB1bmlxdWUgY2FsbGJhY2tJRFxyXG5cdFx0dmFyIGNhbGxiYWNrSUQ7XHJcblx0XHRkbyB7XHJcblx0XHRcdGNhbGxiYWNrSUQgPSBuYW1lICsgJy0nICsgcmFuZG9tRnVuYygpO1xyXG5cdFx0fSB3aGlsZSAoY2FsbGJhY2tzW2NhbGxiYWNrSURdKTtcclxuXHJcblx0XHR2YXIgdGltZW91dEhhbmRsZTtcclxuXHRcdC8vIFNldCB0aW1lb3V0XHJcblx0XHRpZiAodGltZW91dCA+IDApIHtcclxuXHRcdFx0dGltZW91dEhhbmRsZSA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHJlamVjdChFcnJvcignQ2FsbCB0byAnICsgbmFtZSArICcgdGltZWQgb3V0LiBSZXF1ZXN0IElEOiAnICsgY2FsbGJhY2tJRCkpO1xyXG5cdFx0XHR9LCB0aW1lb3V0KTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBTdG9yZSBjYWxsYmFja1xyXG5cdFx0Y2FsbGJhY2tzW2NhbGxiYWNrSURdID0ge1xyXG5cdFx0XHR0aW1lb3V0SGFuZGxlOiB0aW1lb3V0SGFuZGxlLFxyXG5cdFx0XHRyZWplY3Q6IHJlamVjdCxcclxuXHRcdFx0cmVzb2x2ZTogcmVzb2x2ZVxyXG5cdFx0fTtcclxuXHJcblx0XHR0cnkge1xyXG5cdFx0XHRjb25zdCBwYXlsb2FkID0ge1xyXG5cdFx0XHRcdG5hbWUsXHJcblx0XHRcdFx0YXJncyxcclxuXHRcdFx0XHRjYWxsYmFja0lELFxyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0Ly8gTWFrZSB0aGUgY2FsbFxyXG5cdFx0XHR3aW5kb3cuV2FpbHNJbnZva2UoJ0MnICsgSlNPTi5zdHJpbmdpZnkocGF5bG9hZCkpO1xyXG5cdFx0fSBjYXRjaCAoZSkge1xyXG5cdFx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmVcclxuXHRcdFx0Y29uc29sZS5lcnJvcihlKTtcclxuXHRcdH1cclxuXHR9KTtcclxufVxyXG5cclxuXHJcblxyXG4vKipcclxuICogQ2FsbGVkIGJ5IHRoZSBiYWNrZW5kIHRvIHJldHVybiBkYXRhIHRvIGEgcHJldmlvdXNseSBjYWxsZWRcclxuICogYmluZGluZyBpbnZvY2F0aW9uXHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHBhcmFtIHtzdHJpbmd9IGluY29taW5nTWVzc2FnZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIENhbGxiYWNrKGluY29taW5nTWVzc2FnZSkge1xyXG5cdC8vIFBhcnNlIHRoZSBtZXNzYWdlXHJcblx0bGV0IG1lc3NhZ2U7XHJcblx0dHJ5IHtcclxuXHRcdG1lc3NhZ2UgPSBKU09OLnBhcnNlKGluY29taW5nTWVzc2FnZSk7XHJcblx0fSBjYXRjaCAoZSkge1xyXG5cdFx0Y29uc3QgZXJyb3IgPSBgSW52YWxpZCBKU09OIHBhc3NlZCB0byBjYWxsYmFjazogJHtlLm1lc3NhZ2V9LiBNZXNzYWdlOiAke2luY29taW5nTWVzc2FnZX1gO1xyXG5cdFx0cnVudGltZS5Mb2dEZWJ1ZyhlcnJvcik7XHJcblx0XHR0aHJvdyBuZXcgRXJyb3IoZXJyb3IpO1xyXG5cdH1cclxuXHRsZXQgY2FsbGJhY2tJRCA9IG1lc3NhZ2UuY2FsbGJhY2tpZDtcclxuXHRsZXQgY2FsbGJhY2tEYXRhID0gY2FsbGJhY2tzW2NhbGxiYWNrSURdO1xyXG5cdGlmICghY2FsbGJhY2tEYXRhKSB7XHJcblx0XHRjb25zdCBlcnJvciA9IGBDYWxsYmFjayAnJHtjYWxsYmFja0lEfScgbm90IHJlZ2lzdGVyZWQhISFgO1xyXG5cdFx0Y29uc29sZS5lcnJvcihlcnJvcik7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcclxuXHRcdHRocm93IG5ldyBFcnJvcihlcnJvcik7XHJcblx0fVxyXG5cdGNsZWFyVGltZW91dChjYWxsYmFja0RhdGEudGltZW91dEhhbmRsZSk7XHJcblxyXG5cdGRlbGV0ZSBjYWxsYmFja3NbY2FsbGJhY2tJRF07XHJcblxyXG5cdGlmIChtZXNzYWdlLmVycm9yKSB7XHJcblx0XHRjYWxsYmFja0RhdGEucmVqZWN0KG1lc3NhZ2UuZXJyb3IpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRjYWxsYmFja0RhdGEucmVzb2x2ZShtZXNzYWdlLnJlc3VsdCk7XHJcblx0fVxyXG59XHJcbiIsICIvKlxyXG4gXyAgICAgICBfXyAgICAgIF8gX18gICAgXHJcbnwgfCAgICAgLyAvX19fIF8oXykgL19fX19cclxufCB8IC98IC8gLyBfXyBgLyAvIC8gX19fL1xyXG58IHwvIHwvIC8gL18vIC8gLyAoX18gICkgXHJcbnxfXy98X18vXFxfXyxfL18vXy9fX19fLyAgXHJcblRoZSBlbGVjdHJvbiBhbHRlcm5hdGl2ZSBmb3IgR29cclxuKGMpIExlYSBBbnRob255IDIwMTktcHJlc2VudFxyXG4qL1xyXG4vKiBqc2hpbnQgZXN2ZXJzaW9uOiA2ICovXHJcblxyXG5pbXBvcnQge0NhbGx9IGZyb20gJy4vY2FsbHMnO1xyXG5cclxuLy8gVGhpcyBpcyB3aGVyZSB3ZSBiaW5kIGdvIG1ldGhvZCB3cmFwcGVyc1xyXG53aW5kb3cuZ28gPSB7fTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBTZXRCaW5kaW5ncyhiaW5kaW5nc01hcCkge1xyXG5cdHRyeSB7XHJcblx0XHRiaW5kaW5nc01hcCA9IEpTT04ucGFyc2UoYmluZGluZ3NNYXApO1xyXG5cdH0gY2F0Y2ggKGUpIHtcclxuXHRcdGNvbnNvbGUuZXJyb3IoZSk7XHJcblx0fVxyXG5cclxuXHQvLyBJbml0aWFsaXNlIHRoZSBiaW5kaW5ncyBtYXBcclxuXHR3aW5kb3cuZ28gPSB3aW5kb3cuZ28gfHwge307XHJcblxyXG5cdC8vIEl0ZXJhdGUgcGFja2FnZSBuYW1lc1xyXG5cdE9iamVjdC5rZXlzKGJpbmRpbmdzTWFwKS5mb3JFYWNoKChwYWNrYWdlTmFtZSkgPT4ge1xyXG5cclxuXHRcdC8vIENyZWF0ZSBpbm5lciBtYXAgaWYgaXQgZG9lc24ndCBleGlzdFxyXG5cdFx0d2luZG93LmdvW3BhY2thZ2VOYW1lXSA9IHdpbmRvdy5nb1twYWNrYWdlTmFtZV0gfHwge307XHJcblxyXG5cdFx0Ly8gSXRlcmF0ZSBzdHJ1Y3QgbmFtZXNcclxuXHRcdE9iamVjdC5rZXlzKGJpbmRpbmdzTWFwW3BhY2thZ2VOYW1lXSkuZm9yRWFjaCgoc3RydWN0TmFtZSkgPT4ge1xyXG5cclxuXHRcdFx0Ly8gQ3JlYXRlIGlubmVyIG1hcCBpZiBpdCBkb2Vzbid0IGV4aXN0XHJcblx0XHRcdHdpbmRvdy5nb1twYWNrYWdlTmFtZV1bc3RydWN0TmFtZV0gPSB3aW5kb3cuZ29bcGFja2FnZU5hbWVdW3N0cnVjdE5hbWVdIHx8IHt9O1xyXG5cclxuXHRcdFx0T2JqZWN0LmtleXMoYmluZGluZ3NNYXBbcGFja2FnZU5hbWVdW3N0cnVjdE5hbWVdKS5mb3JFYWNoKChtZXRob2ROYW1lKSA9PiB7XHJcblxyXG5cdFx0XHRcdHdpbmRvdy5nb1twYWNrYWdlTmFtZV1bc3RydWN0TmFtZV1bbWV0aG9kTmFtZV0gPSBmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0XHRcdFx0Ly8gTm8gdGltZW91dCBieSBkZWZhdWx0XHJcblx0XHRcdFx0XHRsZXQgdGltZW91dCA9IDA7XHJcblxyXG5cdFx0XHRcdFx0Ly8gQWN0dWFsIGZ1bmN0aW9uXHJcblx0XHRcdFx0XHRmdW5jdGlvbiBkeW5hbWljKCkge1xyXG5cdFx0XHRcdFx0XHRjb25zdCBhcmdzID0gW10uc2xpY2UuY2FsbChhcmd1bWVudHMpO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gQ2FsbChbcGFja2FnZU5hbWUsIHN0cnVjdE5hbWUsIG1ldGhvZE5hbWVdLmpvaW4oJy4nKSwgYXJncywgdGltZW91dCk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gQWxsb3cgc2V0dGluZyB0aW1lb3V0IHRvIGZ1bmN0aW9uXHJcblx0XHRcdFx0XHRkeW5hbWljLnNldFRpbWVvdXQgPSBmdW5jdGlvbiAobmV3VGltZW91dCkge1xyXG5cdFx0XHRcdFx0XHR0aW1lb3V0ID0gbmV3VGltZW91dDtcclxuXHRcdFx0XHRcdH07XHJcblxyXG5cdFx0XHRcdFx0Ly8gQWxsb3cgZ2V0dGluZyB0aW1lb3V0IHRvIGZ1bmN0aW9uXHJcblx0XHRcdFx0XHRkeW5hbWljLmdldFRpbWVvdXQgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0aW1lb3V0O1xyXG5cdFx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0XHRyZXR1cm4gZHluYW1pYztcclxuXHRcdFx0XHR9KCk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fSk7XHJcbn1cclxuIiwgIi8qXHJcbiBfXHQgICBfX1x0ICBfIF9fXHJcbnwgfFx0IC8gL19fXyBfKF8pIC9fX19fXHJcbnwgfCAvfCAvIC8gX18gYC8gLyAvIF9fXy9cclxufCB8LyB8LyAvIC9fLyAvIC8gKF9fICApXHJcbnxfXy98X18vXFxfXyxfL18vXy9fX19fL1xyXG5UaGUgZWxlY3Ryb24gYWx0ZXJuYXRpdmUgZm9yIEdvXHJcbihjKSBMZWEgQW50aG9ueSAyMDE5LXByZXNlbnRcclxuKi9cclxuXHJcbi8qIGpzaGludCBlc3ZlcnNpb246IDkgKi9cclxuXHJcblxyXG5pbXBvcnQge0NhbGx9IGZyb20gXCIuL2NhbGxzXCI7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93UmVsb2FkKCkge1xyXG4gICAgd2luZG93LmxvY2F0aW9uLnJlbG9hZCgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93UmVsb2FkQXBwKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXUicpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93U2V0U3lzdGVtRGVmYXVsdFRoZW1lKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXQVNEVCcpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93U2V0TGlnaHRUaGVtZSgpIHtcclxuICAgIHdpbmRvdy5XYWlsc0ludm9rZSgnV0FMVCcpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93U2V0RGFya1RoZW1lKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXQURUJyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBQbGFjZSB0aGUgd2luZG93IGluIHRoZSBjZW50ZXIgb2YgdGhlIHNjcmVlblxyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93Q2VudGVyKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXYycpO1xyXG59XHJcblxyXG4vKipcclxuICogU2V0cyB0aGUgd2luZG93IHRpdGxlXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSB0aXRsZVxyXG4gKiBAZXhwb3J0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93U2V0VGl0bGUodGl0bGUpIHtcclxuICAgIHdpbmRvdy5XYWlsc0ludm9rZSgnV1QnICsgdGl0bGUpO1xyXG59XHJcblxyXG4vKipcclxuICogTWFrZXMgdGhlIHdpbmRvdyBnbyBmdWxsc2NyZWVuXHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dGdWxsc2NyZWVuKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXRicpO1xyXG59XHJcblxyXG4vKipcclxuICogUmV2ZXJ0cyB0aGUgd2luZG93IGZyb20gZnVsbHNjcmVlblxyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93VW5mdWxsc2NyZWVuKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXZicpO1xyXG59XHJcblxyXG4vKipcclxuICogU2V0IHRoZSBTaXplIG9mIHRoZSB3aW5kb3dcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge251bWJlcn0gd2lkdGhcclxuICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIFdpbmRvd1NldFNpemUod2lkdGgsIGhlaWdodCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXczonICsgd2lkdGggKyAnOicgKyBoZWlnaHQpO1xyXG59XHJcblxyXG4vKipcclxuICogR2V0IHRoZSBTaXplIG9mIHRoZSB3aW5kb3dcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcmV0dXJuIHtQcm9taXNlPHt3OiBudW1iZXIsIGg6IG51bWJlcn0+fSBUaGUgc2l6ZSBvZiB0aGUgd2luZG93XHJcblxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIFdpbmRvd0dldFNpemUoKSB7XHJcbiAgICByZXR1cm4gQ2FsbChcIjp3YWlsczpXaW5kb3dHZXRTaXplXCIpO1xyXG59XHJcblxyXG4vKipcclxuICogU2V0IHRoZSBtYXhpbXVtIHNpemUgb2YgdGhlIHdpbmRvd1xyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aFxyXG4gKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93U2V0TWF4U2l6ZSh3aWR0aCwgaGVpZ2h0KSB7XHJcbiAgICB3aW5kb3cuV2FpbHNJbnZva2UoJ1daOicgKyB3aWR0aCArICc6JyArIGhlaWdodCk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXQgdGhlIG1pbmltdW0gc2l6ZSBvZiB0aGUgd2luZG93XHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dTZXRNaW5TaXplKHdpZHRoLCBoZWlnaHQpIHtcclxuICAgIHdpbmRvdy5XYWlsc0ludm9rZSgnV3o6JyArIHdpZHRoICsgJzonICsgaGVpZ2h0KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNldCB0aGUgUG9zaXRpb24gb2YgdGhlIHdpbmRvd1xyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqIEBwYXJhbSB7bnVtYmVyfSB4XHJcbiAqIEBwYXJhbSB7bnVtYmVyfSB5XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93U2V0UG9zaXRpb24oeCwgeSkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXcDonICsgeCArICc6JyArIHkpO1xyXG59XHJcblxyXG4vKipcclxuICogR2V0IHRoZSBQb3NpdGlvbiBvZiB0aGUgd2luZG93XHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICogQHJldHVybiB7UHJvbWlzZTx7eDogbnVtYmVyLCB5OiBudW1iZXJ9Pn0gVGhlIHBvc2l0aW9uIG9mIHRoZSB3aW5kb3dcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dHZXRQb3NpdGlvbigpIHtcclxuICAgIHJldHVybiBDYWxsKFwiOndhaWxzOldpbmRvd0dldFBvc1wiKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEhpZGUgdGhlIFdpbmRvd1xyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93SGlkZSgpIHtcclxuICAgIHdpbmRvdy5XYWlsc0ludm9rZSgnV0gnKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNob3cgdGhlIFdpbmRvd1xyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93U2hvdygpIHtcclxuICAgIHdpbmRvdy5XYWlsc0ludm9rZSgnV1MnKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIE1heGltaXNlIHRoZSBXaW5kb3dcclxuICpcclxuICogQGV4cG9ydFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIFdpbmRvd01heGltaXNlKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXTScpO1xyXG59XHJcblxyXG4vKipcclxuICogVG9nZ2xlIHRoZSBNYXhpbWlzZSBvZiB0aGUgV2luZG93XHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dUb2dnbGVNYXhpbWlzZSgpIHtcclxuICAgIHdpbmRvdy5XYWlsc0ludm9rZSgnV3QnKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFVubWF4aW1pc2UgdGhlIFdpbmRvd1xyXG4gKlxyXG4gKiBAZXhwb3J0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2luZG93VW5tYXhpbWlzZSgpIHtcclxuICAgIHdpbmRvdy5XYWlsc0ludm9rZSgnV1UnKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIE1pbmltaXNlIHRoZSBXaW5kb3dcclxuICpcclxuICogQGV4cG9ydFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIFdpbmRvd01pbmltaXNlKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXbScpO1xyXG59XHJcblxyXG4vKipcclxuICogVW5taW5pbWlzZSB0aGUgV2luZG93XHJcbiAqXHJcbiAqIEBleHBvcnRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXaW5kb3dVbm1pbmltaXNlKCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdXdScpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFNldHMgdGhlIGJhY2tncm91bmQgY29sb3VyIG9mIHRoZSB3aW5kb3dcclxuICpcclxuICogQGV4cG9ydFxyXG4gKiBAcGFyYW0ge251bWJlcn0gUiBSZWRcclxuICogQHBhcmFtIHtudW1iZXJ9IEcgR3JlZW5cclxuICogQHBhcmFtIHtudW1iZXJ9IEIgQmx1ZVxyXG4gKiBAcGFyYW0ge251bWJlcn0gQSBBbHBoYVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIFdpbmRvd1NldFJHQkEoUiwgRywgQiwgQSkge1xyXG4gICAgbGV0IHJnYmEgPSBKU09OLnN0cmluZ2lmeSh7cjogUiB8fCAwLCBnOiBHIHx8IDAsIGI6IEIgfHwgMCwgYTogQSB8fCAyNTV9KTtcclxuICAgIHdpbmRvdy5XYWlsc0ludm9rZSgnV3I6JyArIHJnYmEpO1xyXG59XHJcblxyXG4iLCAiLyoqXHJcbiAqIEBkZXNjcmlwdGlvbjogVXNlIHRoZSBzeXN0ZW0gZGVmYXVsdCBicm93c2VyIHRvIG9wZW4gdGhlIHVybFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFxyXG4gKiBAcmV0dXJuIHt2b2lkfVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIEJyb3dzZXJPcGVuVVJMKHVybCkge1xyXG4gIHdpbmRvdy5XYWlsc0ludm9rZSgnQk86JyArIHVybCk7XHJcbn0iLCAiLypcclxuIF8gICAgICAgX18gICAgICBfIF9fXHJcbnwgfCAgICAgLyAvX19fIF8oXykgL19fX19cclxufCB8IC98IC8gLyBfXyBgLyAvIC8gX19fL1xyXG58IHwvIHwvIC8gL18vIC8gLyAoX18gIClcclxufF9fL3xfXy9cXF9fLF8vXy9fL19fX18vXHJcblRoZSBlbGVjdHJvbiBhbHRlcm5hdGl2ZSBmb3IgR29cclxuKGMpIExlYSBBbnRob255IDIwMTktcHJlc2VudFxyXG4qL1xyXG5cclxuLyoganNoaW50IGVzdmVyc2lvbjogNiAqL1xyXG5cclxuaW1wb3J0IHtFdmVudHNFbWl0fSBmcm9tICcuL2V2ZW50cyc7XHJcblxyXG5jbGFzcyBDYWNoZUVudHJ5IHtcclxuICAgIGNvbnN0cnVjdG9yKGRhdGEsIG1pbWV0eXBlKSB7XHJcbiAgICAgICAgdGhpcy5kYXRhID0gZGF0YSB8fCBuZXcgQXJyYXlCdWZmZXIoMCk7XHJcbiAgICAgICAgdGhpcy5taW1ldHlwZSA9IG1pbWV0eXBlO1xyXG4gICAgfVxyXG5cclxuICAgIHRvU3RyaW5nKCkge1xyXG4gICAgICAgIGNvbnN0IGFyciA9IG5ldyBVaW50OEFycmF5KHRoaXMuZGF0YSk7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShhcnIpO1xyXG4gICAgfVxyXG5cclxuICAgIHRvalNPTigpIHtcclxuICAgICAgICBjb25zdCBzdHIgPSB0aGlzLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2Uoc3RyKTtcclxuICAgIH1cclxuXHJcbiAgICB0b09iamVjdFVSTCgpIHtcclxuICAgICAgICByZXR1cm4gVVJMLmNyZWF0ZU9iamVjdFVSTChuZXcgQmxvYihbdGhpcy5kYXRhXSkpO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gQ2FjaGVHZXQoa2V5KSB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGZldGNoKFwiL2NhY2hlL1wiICsga2V5KVxyXG4gICAgICAgICAgICAudGhlbigocmVzKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXJlcy5vaykge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKG5ldyBDYWNoZUVudHJ5KCkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgbGV0IG1pbWV0eXBlID0gcmVzLmhlYWRlcnMuZ2V0KFwiY29udGVudC10eXBlXCIpO1xyXG4gICAgICAgICAgICAgICAgcmVzLmFycmF5QnVmZmVyKClcclxuICAgICAgICAgICAgICAgICAgICAudGhlbigoYnVmZmVyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIEV2ZW50c0VtaXQoXCJ3YWlsczpjYWNoZTpnZXRcIiwga2V5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUobmV3IENhY2hlRW50cnkoYnVmZmVyLCBtaW1ldHlwZSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAgICAgLmNhdGNoKChlcnIpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAuY2F0Y2goKGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gQ2FjaGVTZXQoa2V5LCBkYXRhKSB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGxldCBjb252ZXJ0ZWREYXRhID0gZGF0YTtcclxuICAgICAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBjb252ZXJ0ZWREYXRhID0gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBmZXRjaChcIi9jYWNoZS9cIiArIGtleSwge1xyXG4gICAgICAgICAgICBtZXRob2Q6ICdQVVQnLFxyXG4gICAgICAgICAgICBib2R5OiBjb252ZXJ0ZWREYXRhXHJcbiAgICAgICAgfSkudGhlbigocmVzKSA9PiB7XHJcbiAgICAgICAgICAgIGlmICghcmVzLm9rKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgRXZlbnRzRW1pdChcIndhaWxzOmNhY2hlOnNldFwiLCBrZXkpO1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xyXG4gICAgICAgIH0pLmNhdGNoKChlcnIpID0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChlcnIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBDYWNoZURlbGV0ZShrZXkpIHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgZmV0Y2goXCIvY2FjaGUvXCIgKyBrZXksIHtcclxuICAgICAgICAgICAgbWV0aG9kOiAnREVMRVRFJ1xyXG4gICAgICAgIH0pLnRoZW4oKHJlcykgPT4ge1xyXG4gICAgICAgICAgICBpZiAoIXJlcy5vaykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIEV2ZW50c0VtaXQoXCJ3YWlsczpjYWNoZTpkZWxldGVcIiwga2V5KTtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcclxuICAgICAgICB9KS5jYXRjaCgoZXJyKSA9PiB7XHJcbiAgICAgICAgICAgIHJldHVybiByZWplY3QoZXJyKTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG59XHJcblxyXG4iLCAiLypcclxuIF9cdCAgIF9fXHQgIF8gX19cclxufCB8XHQgLyAvX19fIF8oXykgL19fX19cclxufCB8IC98IC8gLyBfXyBgLyAvIC8gX19fL1xyXG58IHwvIHwvIC8gL18vIC8gLyAoX18gIClcclxufF9fL3xfXy9cXF9fLF8vXy9fL19fX18vXHJcblRoZSBlbGVjdHJvbiBhbHRlcm5hdGl2ZSBmb3IgR29cclxuKGMpIExlYSBBbnRob255IDIwMTktcHJlc2VudFxyXG4qL1xyXG4vKiBqc2hpbnQgZXN2ZXJzaW9uOiA5ICovXHJcbmltcG9ydCAqIGFzIExvZyBmcm9tICcuL2xvZyc7XHJcbmltcG9ydCB7ZXZlbnRMaXN0ZW5lcnMsIEV2ZW50c0VtaXQsIEV2ZW50c05vdGlmeSwgRXZlbnRzT2ZmLCBFdmVudHNPbiwgRXZlbnRzT25jZSwgRXZlbnRzT25NdWx0aXBsZX0gZnJvbSAnLi9ldmVudHMnO1xyXG5pbXBvcnQge0NhbGwsIENhbGxiYWNrLCBjYWxsYmFja3N9IGZyb20gJy4vY2FsbHMnO1xyXG5pbXBvcnQge1NldEJpbmRpbmdzfSBmcm9tIFwiLi9iaW5kaW5nc1wiO1xyXG5pbXBvcnQgKiBhcyBXaW5kb3cgZnJvbSBcIi4vd2luZG93XCI7XHJcbmltcG9ydCAqIGFzIEJyb3dzZXIgZnJvbSBcIi4vYnJvd3NlclwiO1xyXG5pbXBvcnQgKiBhcyBDYWNoZSBmcm9tIFwiLi9jYWNoZVwiO1xyXG5cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBRdWl0KCkge1xyXG4gICAgd2luZG93LldhaWxzSW52b2tlKCdRJyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBFbnZpcm9ubWVudCgpIHtcclxuICAgIHJldHVybiBDYWxsKFwiOndhaWxzOkVudmlyb25tZW50XCIpO1xyXG59XHJcblxyXG4vLyBUaGUgSlMgcnVudGltZVxyXG53aW5kb3cucnVudGltZSA9IHtcclxuICAgIC4uLkxvZyxcclxuICAgIC4uLldpbmRvdyxcclxuICAgIC4uLkJyb3dzZXIsXHJcbiAgICAuLi5DYWNoZSxcclxuICAgIEV2ZW50c09uLFxyXG4gICAgRXZlbnRzT25jZSxcclxuICAgIEV2ZW50c09uTXVsdGlwbGUsXHJcbiAgICBFdmVudHNFbWl0LFxyXG4gICAgRXZlbnRzT2ZmLFxyXG4gICAgRW52aXJvbm1lbnQsXHJcbiAgICBRdWl0XHJcbn07XHJcblxyXG4vLyBJbnRlcm5hbCB3YWlscyBlbmRwb2ludHNcclxud2luZG93LndhaWxzID0ge1xyXG4gICAgQ2FsbGJhY2ssXHJcbiAgICBFdmVudHNOb3RpZnksXHJcbiAgICBTZXRCaW5kaW5ncyxcclxuICAgIGV2ZW50TGlzdGVuZXJzLFxyXG4gICAgY2FsbGJhY2tzLFxyXG4gICAgZmxhZ3M6IHtcclxuICAgICAgICBkaXNhYmxlU2Nyb2xsYmFyRHJhZzogZmFsc2UsXHJcbiAgICAgICAgZGlzYWJsZVdhaWxzRGVmYXVsdENvbnRleHRNZW51OiBmYWxzZSxcclxuICAgICAgICBlbmFibGVSZXNpemU6IGZhbHNlLFxyXG4gICAgICAgIGRlZmF1bHRDdXJzb3I6IG51bGwsXHJcbiAgICAgICAgYm9yZGVyVGhpY2tuZXNzOiA2LFxyXG4gICAgICAgIGRiQ2xpY2tJbnRlcnZhbDogMTAwLFxyXG4gICAgfVxyXG59O1xyXG5cclxuLy8gU2V0IHRoZSBiaW5kaW5nc1xyXG53aW5kb3cud2FpbHMuU2V0QmluZGluZ3Mod2luZG93LndhaWxzYmluZGluZ3MpO1xyXG5kZWxldGUgd2luZG93LndhaWxzLlNldEJpbmRpbmdzO1xyXG5cclxuLy8gVGhpcyBpcyBldmFsdWF0ZWQgYXQgYnVpbGQgdGltZSBpbiBwYWNrYWdlLmpzb25cclxuLy8gY29uc3QgZGV2ID0gMDtcclxuLy8gY29uc3QgcHJvZHVjdGlvbiA9IDE7XHJcbmlmIChFTlYgPT09IDApIHtcclxuICAgIGRlbGV0ZSB3aW5kb3cud2FpbHNiaW5kaW5ncztcclxufVxyXG5cclxudmFyIGRyYWdUaW1lT3V0O1xyXG52YXIgZHJhZ0xhc3RUaW1lID0gMDtcclxuXHJcbmZ1bmN0aW9uIGRyYWcoKSB7XHJcbiAgICB3aW5kb3cuV2FpbHNJbnZva2UoXCJkcmFnXCIpO1xyXG59XHJcblxyXG4vLyBTZXR1cCBkcmFnIGhhbmRsZXJcclxuLy8gQmFzZWQgb24gY29kZSBmcm9tOiBodHRwczovL2dpdGh1Yi5jb20vcGF0cjBudXMvRGVza0dhcFxyXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgKGUpID0+IHtcclxuXHJcbiAgICAvLyBDaGVjayBmb3IgcmVzaXppbmdcclxuICAgIGlmICh3aW5kb3cud2FpbHMuZmxhZ3MucmVzaXplRWRnZSkge1xyXG4gICAgICAgIHdpbmRvdy5XYWlsc0ludm9rZShcInJlc2l6ZTpcIiArIHdpbmRvdy53YWlscy5mbGFncy5yZXNpemVFZGdlKTtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIENoZWNrIGZvciBkcmFnZ2luZ1xyXG4gICAgbGV0IGN1cnJlbnRFbGVtZW50ID0gZS50YXJnZXQ7XHJcbiAgICB3aGlsZSAoY3VycmVudEVsZW1lbnQgIT0gbnVsbCkge1xyXG4gICAgICAgIGlmIChjdXJyZW50RWxlbWVudC5oYXNBdHRyaWJ1dGUoJ2RhdGEtd2FpbHMtbm8tZHJhZycpKSB7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoY3VycmVudEVsZW1lbnQuaGFzQXR0cmlidXRlKCdkYXRhLXdhaWxzLWRyYWcnKSkge1xyXG4gICAgICAgICAgICBpZiAod2luZG93LndhaWxzLmZsYWdzLmRpc2FibGVTY3JvbGxiYXJEcmFnKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBUaGlzIGNoZWNrcyBmb3IgY2xpY2tzIG9uIHRoZSBzY3JvbGwgYmFyXHJcbiAgICAgICAgICAgICAgICBpZiAoZS5vZmZzZXRYID4gZS50YXJnZXQuY2xpZW50V2lkdGggfHwgZS5vZmZzZXRZID4gZS50YXJnZXQuY2xpZW50SGVpZ2h0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gZHJhZ0xhc3RUaW1lIDwgd2luZG93LndhaWxzLmZsYWdzLmRiQ2xpY2tJbnRlcnZhbCkge1xyXG4gICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KGRyYWdUaW1lT3V0KTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGRyYWdUaW1lT3V0ID0gc2V0VGltZW91dChkcmFnLCB3aW5kb3cud2FpbHMuZmxhZ3MuZGJDbGlja0ludGVydmFsKTtcclxuICAgICAgICAgICAgZHJhZ0xhc3RUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGN1cnJlbnRFbGVtZW50ID0gY3VycmVudEVsZW1lbnQucGFyZW50RWxlbWVudDtcclxuICAgIH1cclxufSk7XHJcblxyXG5mdW5jdGlvbiBzZXRSZXNpemUoY3Vyc29yKSB7XHJcbiAgICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9IGN1cnNvciB8fCB3aW5kb3cud2FpbHMuZmxhZ3MuZGVmYXVsdEN1cnNvcjtcclxuICAgIHdpbmRvdy53YWlscy5mbGFncy5yZXNpemVFZGdlID0gY3Vyc29yO1xyXG59XHJcblxyXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgZnVuY3Rpb24gKGUpIHtcclxuICAgIGlmICghd2luZG93LndhaWxzLmZsYWdzLmVuYWJsZVJlc2l6ZSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGlmICh3aW5kb3cud2FpbHMuZmxhZ3MuZGVmYXVsdEN1cnNvciA9PSBudWxsKSB7XHJcbiAgICAgICAgd2luZG93LndhaWxzLmZsYWdzLmRlZmF1bHRDdXJzb3IgPSBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvcjtcclxuICAgIH1cclxuICAgIGlmICh3aW5kb3cub3V0ZXJXaWR0aCAtIGUuY2xpZW50WCA8IHdpbmRvdy53YWlscy5mbGFncy5ib3JkZXJUaGlja25lc3MgJiYgd2luZG93Lm91dGVySGVpZ2h0IC0gZS5jbGllbnRZIDwgd2luZG93LndhaWxzLmZsYWdzLmJvcmRlclRoaWNrbmVzcykge1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkuc3R5bGUuY3Vyc29yID0gXCJzZS1yZXNpemVcIjtcclxuICAgIH1cclxuICAgIGxldCByaWdodEJvcmRlciA9IHdpbmRvdy5vdXRlcldpZHRoIC0gZS5jbGllbnRYIDwgd2luZG93LndhaWxzLmZsYWdzLmJvcmRlclRoaWNrbmVzcztcclxuICAgIGxldCBsZWZ0Qm9yZGVyID0gZS5jbGllbnRYIDwgd2luZG93LndhaWxzLmZsYWdzLmJvcmRlclRoaWNrbmVzcztcclxuICAgIGxldCB0b3BCb3JkZXIgPSBlLmNsaWVudFkgPCB3aW5kb3cud2FpbHMuZmxhZ3MuYm9yZGVyVGhpY2tuZXNzO1xyXG4gICAgbGV0IGJvdHRvbUJvcmRlciA9IHdpbmRvdy5vdXRlckhlaWdodCAtIGUuY2xpZW50WSA8IHdpbmRvdy53YWlscy5mbGFncy5ib3JkZXJUaGlja25lc3M7XHJcblxyXG4gICAgLy8gSWYgd2UgYXJlbid0IG9uIGFuIGVkZ2UsIGJ1dCB3ZXJlLCByZXNldCB0aGUgY3Vyc29yIHRvIGRlZmF1bHRcclxuICAgIGlmICghbGVmdEJvcmRlciAmJiAhcmlnaHRCb3JkZXIgJiYgIXRvcEJvcmRlciAmJiAhYm90dG9tQm9yZGVyICYmIHdpbmRvdy53YWlscy5mbGFncy5yZXNpemVFZGdlICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICBzZXRSZXNpemUoKTtcclxuICAgIH0gZWxzZSBpZiAocmlnaHRCb3JkZXIgJiYgYm90dG9tQm9yZGVyKSBzZXRSZXNpemUoXCJzZS1yZXNpemVcIik7XHJcbiAgICBlbHNlIGlmIChsZWZ0Qm9yZGVyICYmIGJvdHRvbUJvcmRlcikgc2V0UmVzaXplKFwic3ctcmVzaXplXCIpO1xyXG4gICAgZWxzZSBpZiAobGVmdEJvcmRlciAmJiB0b3BCb3JkZXIpIHNldFJlc2l6ZShcIm53LXJlc2l6ZVwiKTtcclxuICAgIGVsc2UgaWYgKHRvcEJvcmRlciAmJiByaWdodEJvcmRlcikgc2V0UmVzaXplKFwibmUtcmVzaXplXCIpO1xyXG4gICAgZWxzZSBpZiAobGVmdEJvcmRlcikgc2V0UmVzaXplKFwidy1yZXNpemVcIik7XHJcbiAgICBlbHNlIGlmICh0b3BCb3JkZXIpIHNldFJlc2l6ZShcIm4tcmVzaXplXCIpO1xyXG4gICAgZWxzZSBpZiAoYm90dG9tQm9yZGVyKSBzZXRSZXNpemUoXCJzLXJlc2l6ZVwiKTtcclxuICAgIGVsc2UgaWYgKHJpZ2h0Qm9yZGVyKSBzZXRSZXNpemUoXCJlLXJlc2l6ZVwiKTtcclxuXHJcbn0pO1xyXG5cclxuLy8gU2V0dXAgY29udGV4dCBtZW51IGhvb2tcclxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgZnVuY3Rpb24gKGUpIHtcclxuICAgIGlmICh3aW5kb3cud2FpbHMuZmxhZ3MuZGlzYWJsZVdhaWxzRGVmYXVsdENvbnRleHRNZW51KSB7XHJcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgfVxyXG59KTsiXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBa0JBLDBCQUF3QixPQUFPLFNBQVM7QUFJdkMsV0FBTyxZQUFZLE1BQU0sUUFBUTtBQUFBO0FBUzNCLG9CQUFrQixTQUFTO0FBQ2pDLG1CQUFl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
