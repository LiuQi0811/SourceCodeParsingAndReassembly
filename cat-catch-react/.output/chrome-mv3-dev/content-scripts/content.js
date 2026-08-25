(function() {
  "use strict";var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  var _a, _b, _c, _d, _e;
  function defineContentScript(definition2) {
    return definition2;
  }
  const definition = defineContentScript({
    matches: ["https://*/*", "http://*/*"],
    runAt: "document_start",
    allFrames: true,
    main() {
      let videoObj = [];
      let videoSrc = [];
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (chrome.runtime.lastError) return;
        if (msg.Message === "getVideoState") {
          const newObj = [];
          const newSrc = [];
          document.querySelectorAll("video, audio").forEach((el) => {
            if (el.currentSrc) {
              newObj.push(el);
              newSrc.push(el.currentSrc);
            }
          });
          document.querySelectorAll("iframe").forEach((iframe) => {
            if (!iframe.contentDocument) return;
            iframe.contentDocument.querySelectorAll("video, audio").forEach((el) => {
              if (el.currentSrc) {
                newObj.push(el);
                newSrc.push(el.currentSrc);
              }
            });
          });
          if (newObj.length > 0) {
            if (newObj.length !== videoObj.length || newSrc.toString() !== videoSrc.toString()) {
              videoObj = newObj;
              videoSrc = newSrc;
            }
            const idx = msg.index === -1 ? 0 : msg.index ?? 0;
            const v = videoObj[idx];
            if (!v) {
              sendResponse({ count: videoObj.length });
              return true;
            }
            const timePct = v.currentTime / (v.duration || 1) * 100;
            sendResponse({
              time: timePct,
              currentTime: v.currentTime,
              duration: v.duration,
              volume: v.volume,
              count: videoObj.length,
              src: videoSrc,
              paused: v.paused,
              loop: v.loop,
              speed: v.playbackRate,
              muted: v.muted,
              type: v.tagName.toLowerCase(),
              videoStatus: videoObj.map((el) => el.paused ? 1 : 0)
            });
            return true;
          }
          sendResponse({ count: 0 });
          return true;
        }
        if (msg.Message === "speed") {
          const v = videoObj[msg.index];
          if (v && v.playbackRate !== void 0) v.playbackRate = msg.speed;
          return true;
        }
        if (msg.Message === "pip") {
          if (document.pictureInPictureElement) {
            try {
              void document.exitPictureInPicture();
              sendResponse({ state: false });
            } catch {
            }
            return true;
          }
          try {
            const v = videoObj[msg.index];
            void (v == null ? void 0 : v.requestPictureInPicture());
            sendResponse({ state: true });
          } catch {
          }
          return true;
        }
        if (msg.Message === "fullScreen") {
          if (document.fullscreenElement) {
            try {
              void document.exitFullscreen();
              sendResponse({ state: false });
            } catch {
            }
            return true;
          }
          try {
            const v = videoObj[msg.index];
            void (v == null ? void 0 : v.requestFullscreen());
            sendResponse({ state: true });
          } catch {
          }
          return true;
        }
        if (msg.Message === "play") {
          const v = videoObj[msg.index];
          if (!v) return true;
          if (v.paused) {
            void v.play();
          } else {
            v.pause();
          }
          return true;
        }
        if (msg.Message === "muted") {
          const v = videoObj[msg.index];
          if (v) v.muted = !v.muted;
          return true;
        }
        if (msg.Message === "volume") {
          const v = videoObj[msg.index];
          if (v) {
            v.volume = msg.volume;
            if (msg.volume > 0 && v.muted) v.muted = false;
          }
          return true;
        }
        if (msg.Message === "seek") {
          const v = videoObj[msg.index];
          if (v) {
            try {
              v.currentTime = msg.time / 100 * v.duration;
            } catch {
            }
          }
          return true;
        }
        if (msg.Message === "loop") {
          const v = videoObj[msg.index];
          if (v) v.loop = !v.loop;
          return true;
        }
        if (msg.Message === "screenshot") {
          const v = videoObj[msg.index];
          if (v && v.videoWidth) {
            const canvas = document.createElement("canvas");
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(v, 0, 0);
              canvas.toBlob((blob) => {
                if (!blob) return;
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = blobUrl;
                a.download = `cat-catch-screenshot-${Date.now()}.png`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1e3);
              }, "image/png");
            }
          }
          return true;
        }
        if (msg.Message === "ffmpeg") {
          if (!msg.files) {
            window.postMessage(msg);
            sendResponse("ok");
            return true;
          }
          msg.quantity ?? (msg.quantity = msg.files.length);
          for (const item of msg.files) {
            const data = { ...msg, ...item };
            data.type = item.type ?? "video";
            if (data.data instanceof Blob) {
              window.postMessage(data);
            } else {
              fetch(data.data).then((r) => r.blob()).then((blob) => {
                data.data = blob;
                window.postMessage(data);
              });
            }
          }
          sendResponse("ok");
          return true;
        }
        return;
      });
      window.addEventListener("message", (event) => {
        var _a2, _b2;
        const action = ["catCatchAddMedia", "catCatchAddKey", "catCatchFFmpeg", "catCatchFFmpegResult", "catCatchCloseScript"];
        if (!event.data || !event.data.action || event.origin !== window.location.origin || !action.includes(event.data.action)) return;
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (event.data.action === "catCatchFFmpeg") {
          if (!event.data.use || !event.data.files || !Array.isArray(event.data.files) || event.data.files.length === 0) return;
          event.data.title = event.data.title ?? document.title ?? Date.now().toString();
          event.data.title = event.data.title.replaceAll('"', "").replaceAll("'", "").replaceAll(" ", "");
          const data = {
            Message: event.data.action,
            action: event.data.use,
            files: event.data.files,
            url: event.data.href ?? (((_b2 = (_a2 = event.source) == null ? void 0 : _a2.location) == null ? void 0 : _b2.href) ?? ""),
            ...event.data
          };
          chrome.runtime.sendMessage(data);
        }
        if (event.data.action === "catCatchFFmpegResult") {
          if (!event.data.state || !event.data.tabId) return;
          chrome.runtime.sendMessage({ Message: "catCatchFFmpegResult", ...event.data });
        }
        if (event.data.action === "catCatchCloseScript") {
          if (!event.data.script || !event.isTrusted) return;
          chrome.runtime.sendMessage({ Message: "closeScript", ...event.data });
        }
      }, { capture: true });
    }
  });
  function print$1(method, ...args) {
    if (typeof args[0] === "string") method(`[wxt] ${args.shift()}`, ...args);
    else method("[wxt]", ...args);
  }
  const logger$1 = {
    debug: (...args) => print$1(console.debug, ...args),
    log: (...args) => print$1(console.log, ...args),
    warn: (...args) => print$1(console.warn, ...args),
    error: (...args) => print$1(console.error, ...args)
  };
  const browser$1 = ((_b = (_a = globalThis.browser) == null ? void 0 : _a.runtime) == null ? void 0 : _b.id) ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  var WxtLocationChangeEvent = (_c = class extends Event {
    constructor(newUrl, oldUrl) {
      super(_c.EVENT_NAME, {});
      this.newUrl = newUrl;
      this.oldUrl = oldUrl;
    }
  }, __publicField(_c, "EVENT_NAME", getUniqueEventName("wxt:locationchange")), _c);
  function getUniqueEventName(eventName) {
    var _a2;
    return `${(_a2 = browser == null ? void 0 : browser.runtime) == null ? void 0 : _a2.id}:${"content"}:${eventName}`;
  }
  const supportsNavigationApi = typeof ((_d = globalThis.navigation) == null ? void 0 : _d.addEventListener) === "function";
  function createLocationWatcher(ctx) {
    let lastUrl;
    let watching = false;
    return { run() {
      if (watching) return;
      watching = true;
      lastUrl = new URL(location.href);
      if (supportsNavigationApi) globalThis.navigation.addEventListener("navigate", (event) => {
        const newUrl = new URL(event.destination.url);
        if (newUrl.href === lastUrl.href) return;
        window.dispatchEvent(new WxtLocationChangeEvent(newUrl, lastUrl));
        lastUrl = newUrl;
      }, { signal: ctx.signal });
      else ctx.setInterval(() => {
        const newUrl = new URL(location.href);
        if (newUrl.href !== lastUrl.href) {
          window.dispatchEvent(new WxtLocationChangeEvent(newUrl, lastUrl));
          lastUrl = newUrl;
        }
      }, 1e3);
    } };
  }
  var ContentScriptContext = (_e = class {
    constructor(contentScriptName, options) {
      __publicField(this, "id");
      __publicField(this, "abortController");
      __publicField(this, "locationWatcher", createLocationWatcher(this));
      this.contentScriptName = contentScriptName;
      this.options = options;
      this.id = Math.random().toString(36).slice(2);
      this.abortController = new AbortController();
      this.stopOldScripts();
      this.listenForNewerScripts();
    }
    get signal() {
      return this.abortController.signal;
    }
    abort(reason) {
      return this.abortController.abort(reason);
    }
    get isInvalid() {
      var _a2;
      if (((_a2 = browser.runtime) == null ? void 0 : _a2.id) == null) this.notifyInvalidated();
      return this.signal.aborted;
    }
    get isValid() {
      return !this.isInvalid;
    }
    /**
    * Add a listener that is called when the content script's context is
    * invalidated.
    *
    * @example
    *   browser.runtime.onMessage.addListener(cb);
    *   const removeInvalidatedListener = ctx.onInvalidated(() => {
    *     browser.runtime.onMessage.removeListener(cb);
    *   });
    *   // ...
    *   removeInvalidatedListener();
    *
    * @returns A function to remove the listener.
    */
    onInvalidated(cb) {
      this.signal.addEventListener("abort", cb);
      return () => this.signal.removeEventListener("abort", cb);
    }
    /**
    * Return a promise that never resolves. Useful if you have an async function
    * that shouldn't run after the context is expired.
    *
    * @example
    *   const getValueFromStorage = async () => {
    *     if (ctx.isInvalid) return ctx.block();
    *
    *     // ...
    *   };
    */
    block() {
      return new Promise(() => {
      });
    }
    /**
    * Wrapper around `window.setInterval` that automatically clears the interval
    * when invalidated.
    *
    * Intervals can be cleared by calling the normal `clearInterval` function.
    */
    setInterval(handler, timeout) {
      const id = setInterval(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearInterval(id));
      return id;
    }
    /**
    * Wrapper around `window.setTimeout` that automatically clears the interval
    * when invalidated.
    *
    * Timeouts can be cleared by calling the normal `setTimeout` function.
    */
    setTimeout(handler, timeout) {
      const id = setTimeout(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearTimeout(id));
      return id;
    }
    /**
    * Wrapper around `window.requestAnimationFrame` that automatically cancels
    * the request when invalidated.
    *
    * Callbacks can be canceled by calling the normal `cancelAnimationFrame`
    * function.
    */
    requestAnimationFrame(callback) {
      const id = requestAnimationFrame((...args) => {
        if (this.isValid) callback(...args);
      });
      this.onInvalidated(() => cancelAnimationFrame(id));
      return id;
    }
    /**
    * Wrapper around `window.requestIdleCallback` that automatically cancels the
    * request when invalidated.
    *
    * Callbacks can be canceled by calling the normal `cancelIdleCallback`
    * function.
    */
    requestIdleCallback(callback, options) {
      const id = requestIdleCallback((...args) => {
        if (!this.signal.aborted) callback(...args);
      }, options);
      this.onInvalidated(() => cancelIdleCallback(id));
      return id;
    }
    addEventListener(target, type, handler, options) {
      var _a2;
      if (type === "wxt:locationchange") {
        if (this.isValid) this.locationWatcher.run();
      }
      (_a2 = target.addEventListener) == null ? void 0 : _a2.call(target, type.startsWith("wxt:") ? getUniqueEventName(type) : type, handler, {
        ...options,
        signal: this.signal
      });
    }
    /**
    * @internal
    * Abort the abort controller and execute all `onInvalidated` listeners.
    */
    notifyInvalidated() {
      this.abort("Content script context invalidated");
      logger$1.debug(`Content script "${this.contentScriptName}" context invalidated`);
    }
    stopOldScripts() {
      var _a2;
      document.dispatchEvent(new CustomEvent(_e.SCRIPT_STARTED_MESSAGE_TYPE, { detail: {
        contentScriptName: this.contentScriptName,
        messageId: this.id
      } }));
      if (!((_a2 = this.options) == null ? void 0 : _a2.noScriptStartedPostMessage)) window.postMessage({
        type: _e.SCRIPT_STARTED_MESSAGE_TYPE,
        contentScriptName: this.contentScriptName,
        messageId: this.id
      }, "*");
    }
    verifyScriptStartedEvent(event) {
      var _a2, _b2;
      const isSameContentScript = ((_a2 = event.detail) == null ? void 0 : _a2.contentScriptName) === this.contentScriptName;
      const isFromSelf = ((_b2 = event.detail) == null ? void 0 : _b2.messageId) === this.id;
      return isSameContentScript && !isFromSelf;
    }
    listenForNewerScripts() {
      const cb = (event) => {
        if (!(event instanceof CustomEvent) || !this.verifyScriptStartedEvent(event)) return;
        this.notifyInvalidated();
      };
      document.addEventListener(_e.SCRIPT_STARTED_MESSAGE_TYPE, cb);
      this.onInvalidated(() => document.removeEventListener(_e.SCRIPT_STARTED_MESSAGE_TYPE, cb));
    }
  }, __publicField(_e, "SCRIPT_STARTED_MESSAGE_TYPE", getUniqueEventName("wxt:content-script-started")), _e);
  function initPlugins() {
  }
  function print(method, ...args) {
    if (typeof args[0] === "string") method(`[wxt] ${args.shift()}`, ...args);
    else method("[wxt]", ...args);
  }
  const logger = {
    debug: (...args) => print(console.debug, ...args),
    log: (...args) => print(console.log, ...args),
    warn: (...args) => print(console.warn, ...args),
    error: (...args) => print(console.error, ...args)
  };
  const result = (async () => {
    try {
      initPlugins();
      const { main, ...options } = definition;
      return await main(new ContentScriptContext("content", options));
    } catch (err) {
      logger.error(`The content script "${"content"}" crashed on startup!`, err);
      throw err;
    }
  })();
  return result;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIxLjRfdHlwZXNjcmlwdEA1LjkuM192aXRlQDYuNC4zL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQubWpzIiwiLi4vLi4vLi4vc3JjL2VudHJ5cG9pbnRzL2NvbnRlbnQudHMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjEuNF90eXBlc2NyaXB0QDUuOS4zX3ZpdGVANi40LjMvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vQHd4dC1kZXYrYnJvd3NlckAwLjIuNy9ub2RlX21vZHVsZXMvQHd4dC1kZXYvYnJvd3Nlci9zcmMvaW5kZXgubWpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIxLjRfdHlwZXNjcmlwdEA1LjkuM192aXRlQDYuNC4zL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMS40X3R5cGVzY3JpcHRANS45LjNfdml0ZUA2LjQuMy9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjEuNF90eXBlc2NyaXB0QDUuOS4zX3ZpdGVANi40LjMvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIxLjRfdHlwZXNjcmlwdEA1LjkuM192aXRlQDYuNC4zL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9jb250ZW50LXNjcmlwdC1jb250ZXh0Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC50c1xuZnVuY3Rpb24gZGVmaW5lQ29udGVudFNjcmlwdChkZWZpbml0aW9uKSB7XG5cdHJldHVybiBkZWZpbml0aW9uO1xufVxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBkZWZpbmVDb250ZW50U2NyaXB0IH07XG4iLCIvKipcbiAqIENvbnRlbnQgU2NyaXB0XG4gKiAxOjEg6L+Y5Y6f5Y6fIGpzL2NvbnRlbnQtc2NyaXB0LmpzXG4gKiAtIOWcqCBkb2N1bWVudF9zdGFydCDms6jlhaUsYWxsX2ZyYW1lc1xuICogLSDnm5HlkKwgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLOWTjeW6lCBwb3B1cCDlj5Hlh7rnmoTop4bpopHmjqfliLbmjIfku6RcbiAqICAgZ2V0VmlkZW9TdGF0ZSAvIHNwZWVkIC8gcGlwIC8gZnVsbFNjcmVlbiAvIGxvb3AgLyBtdXRlZCAvIHZvbHVtZSAuLi5cbiAqL1xuaW1wb3J0IHsgZGVmaW5lQ29udGVudFNjcmlwdCB9IGZyb20gJ3d4dC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWydodHRwczovLyovKicsICdodHRwOi8vKi8qJ10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfc3RhcnQnLFxuICBhbGxGcmFtZXM6IHRydWUsXG4gIG1haW4oKSB7XG4gICAgbGV0IHZpZGVvT2JqOiBIVE1MTWVkaWFFbGVtZW50W10gPSBbXTtcbiAgICBsZXQgdmlkZW9TcmM6IHN0cmluZ1tdID0gW107XG5cbiAgICBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKG1zZywgX3NlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XG4gICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSByZXR1cm47XG5cbiAgICAgIC8vID09PSDojrflj5bpobXpnaLop4bpopHlr7nosaHnirbmgIEgPT09XG4gICAgICBpZiAobXNnLk1lc3NhZ2UgPT09ICdnZXRWaWRlb1N0YXRlJykge1xuICAgICAgICBjb25zdCBuZXdPYmo6IEhUTUxNZWRpYUVsZW1lbnRbXSA9IFtdO1xuICAgICAgICBjb25zdCBuZXdTcmM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTE1lZGlhRWxlbWVudD4oJ3ZpZGVvLCBhdWRpbycpLmZvckVhY2goKGVsKSA9PiB7XG4gICAgICAgICAgaWYgKGVsLmN1cnJlbnRTcmMpIHtcbiAgICAgICAgICAgIG5ld09iai5wdXNoKGVsKTtcbiAgICAgICAgICAgIG5ld1NyYy5wdXNoKGVsLmN1cnJlbnRTcmMpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTElGcmFtZUVsZW1lbnQ+KCdpZnJhbWUnKS5mb3JFYWNoKChpZnJhbWUpID0+IHtcbiAgICAgICAgICBpZiAoIWlmcmFtZS5jb250ZW50RG9jdW1lbnQpIHJldHVybjtcbiAgICAgICAgICBpZnJhbWUuY29udGVudERvY3VtZW50XG4gICAgICAgICAgICAucXVlcnlTZWxlY3RvckFsbDxIVE1MTWVkaWFFbGVtZW50PigndmlkZW8sIGF1ZGlvJylcbiAgICAgICAgICAgIC5mb3JFYWNoKChlbCkgPT4ge1xuICAgICAgICAgICAgICBpZiAoZWwuY3VycmVudFNyYykge1xuICAgICAgICAgICAgICAgIG5ld09iai5wdXNoKGVsKTtcbiAgICAgICAgICAgICAgICBuZXdTcmMucHVzaChlbC5jdXJyZW50U3JjKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChuZXdPYmoubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGlmIChuZXdPYmoubGVuZ3RoICE9PSB2aWRlb09iai5sZW5ndGggfHwgbmV3U3JjLnRvU3RyaW5nKCkgIT09IHZpZGVvU3JjLnRvU3RyaW5nKCkpIHtcbiAgICAgICAgICAgIHZpZGVvT2JqID0gbmV3T2JqO1xuICAgICAgICAgICAgdmlkZW9TcmMgPSBuZXdTcmM7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGlkeCA9IG1zZy5pbmRleCA9PT0gLTEgPyAwIDogbXNnLmluZGV4ID8/IDA7XG4gICAgICAgICAgY29uc3QgdiA9IHZpZGVvT2JqW2lkeF07XG4gICAgICAgICAgaWYgKCF2KSB7XG4gICAgICAgICAgICBzZW5kUmVzcG9uc2UoeyBjb3VudDogdmlkZW9PYmoubGVuZ3RoIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHRpbWVQY3QgPSAodi5jdXJyZW50VGltZSAvICh2LmR1cmF0aW9uIHx8IDEpKSAqIDEwMDtcbiAgICAgICAgICBzZW5kUmVzcG9uc2Uoe1xuICAgICAgICAgICAgdGltZTogdGltZVBjdCxcbiAgICAgICAgICAgIGN1cnJlbnRUaW1lOiB2LmN1cnJlbnRUaW1lLFxuICAgICAgICAgICAgZHVyYXRpb246IHYuZHVyYXRpb24sXG4gICAgICAgICAgICB2b2x1bWU6IHYudm9sdW1lLFxuICAgICAgICAgICAgY291bnQ6IHZpZGVvT2JqLmxlbmd0aCxcbiAgICAgICAgICAgIHNyYzogdmlkZW9TcmMsXG4gICAgICAgICAgICBwYXVzZWQ6IHYucGF1c2VkLFxuICAgICAgICAgICAgbG9vcDogdi5sb29wLFxuICAgICAgICAgICAgc3BlZWQ6IHYucGxheWJhY2tSYXRlLFxuICAgICAgICAgICAgbXV0ZWQ6IHYubXV0ZWQsXG4gICAgICAgICAgICB0eXBlOiB2LnRhZ05hbWUudG9Mb3dlckNhc2UoKSxcbiAgICAgICAgICAgIHZpZGVvU3RhdHVzOiB2aWRlb09iai5tYXAoKGVsKSA9PiAoZWwucGF1c2VkID8gMSA6IDApKSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBzZW5kUmVzcG9uc2UoeyBjb3VudDogMCB9KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vID09PSDpgJ/luqbmjqfliLYgPT09XG4gICAgICBpZiAobXNnLk1lc3NhZ2UgPT09ICdzcGVlZCcpIHtcbiAgICAgICAgY29uc3QgdiA9IHZpZGVvT2JqW21zZy5pbmRleF07XG4gICAgICAgIGlmICh2ICYmIHYucGxheWJhY2tSYXRlICE9PSB1bmRlZmluZWQpIHYucGxheWJhY2tSYXRlID0gbXNnLnNwZWVkO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gPT09IOeUu+S4reeUuyA9PT1cbiAgICAgIGlmIChtc2cuTWVzc2FnZSA9PT0gJ3BpcCcpIHtcbiAgICAgICAgaWYgKGRvY3VtZW50LnBpY3R1cmVJblBpY3R1cmVFbGVtZW50KSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZvaWQgZG9jdW1lbnQuZXhpdFBpY3R1cmVJblBpY3R1cmUoKTtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IHN0YXRlOiBmYWxzZSB9KTtcbiAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8qIGlnbm9yZSAqL1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHYgPSB2aWRlb09ialttc2cuaW5kZXhdIGFzIHVua25vd24gYXMgSFRNTFZpZGVvRWxlbWVudCB8IHVuZGVmaW5lZDtcbiAgICAgICAgICB2b2lkIHY/LnJlcXVlc3RQaWN0dXJlSW5QaWN0dXJlKCk7XG4gICAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3RhdGU6IHRydWUgfSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIC8qIGlnbm9yZSAqL1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyA9PT0g5YWo5bGPID09PVxuICAgICAgaWYgKG1zZy5NZXNzYWdlID09PSAnZnVsbFNjcmVlbicpIHtcbiAgICAgICAgaWYgKGRvY3VtZW50LmZ1bGxzY3JlZW5FbGVtZW50KSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZvaWQgZG9jdW1lbnQuZXhpdEZ1bGxzY3JlZW4oKTtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZSh7IHN0YXRlOiBmYWxzZSB9KTtcbiAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8qIGlnbm9yZSAqL1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHYgPSB2aWRlb09ialttc2cuaW5kZXhdO1xuICAgICAgICAgIHZvaWQgKHYgYXMgdW5rbm93biBhcyBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZCk/LnJlcXVlc3RGdWxsc2NyZWVuKCk7XG4gICAgICAgICAgc2VuZFJlc3BvbnNlKHsgc3RhdGU6IHRydWUgfSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgIC8qIGlnbm9yZSAqL1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyA9PT0g5pKt5pS+L+aaguWBnCA9PT1cbiAgICAgIGlmIChtc2cuTWVzc2FnZSA9PT0gJ3BsYXknKSB7XG4gICAgICAgIGNvbnN0IHYgPSB2aWRlb09ialttc2cuaW5kZXhdO1xuICAgICAgICBpZiAoIXYpIHJldHVybiB0cnVlO1xuICAgICAgICBpZiAodi5wYXVzZWQpIHtcbiAgICAgICAgICB2b2lkIHYucGxheSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHYucGF1c2UoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gPT09IOmdmemfs+WIh+aNoiA9PT1cbiAgICAgIGlmIChtc2cuTWVzc2FnZSA9PT0gJ211dGVkJykge1xuICAgICAgICBjb25zdCB2ID0gdmlkZW9PYmpbbXNnLmluZGV4XTtcbiAgICAgICAgaWYgKHYpIHYubXV0ZWQgPSAhdi5tdXRlZDtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vID09PSDpn7Pph48gPT09XG4gICAgICBpZiAobXNnLk1lc3NhZ2UgPT09ICd2b2x1bWUnKSB7XG4gICAgICAgIGNvbnN0IHYgPSB2aWRlb09ialttc2cuaW5kZXhdO1xuICAgICAgICBpZiAodikge1xuICAgICAgICAgIHYudm9sdW1lID0gbXNnLnZvbHVtZTtcbiAgICAgICAgICBpZiAobXNnLnZvbHVtZSA+IDAgJiYgdi5tdXRlZCkgdi5tdXRlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyA9PT0g6Lez6L2s6L+b5bqmID09PVxuICAgICAgaWYgKG1zZy5NZXNzYWdlID09PSAnc2VlaycpIHtcbiAgICAgICAgY29uc3QgdiA9IHZpZGVvT2JqW21zZy5pbmRleF07XG4gICAgICAgIGlmICh2KSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHYuY3VycmVudFRpbWUgPSAobXNnLnRpbWUgLyAxMDApICogdi5kdXJhdGlvbjtcbiAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8qIGlnbm9yZSAqL1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLy8gPT09IOW+queOr+WIh+aNoijov5jljp/ljp8gY29udGVudC1zY3JpcHQgbG9vcCkgPT09XG4gICAgICBpZiAobXNnLk1lc3NhZ2UgPT09ICdsb29wJykge1xuICAgICAgICBjb25zdCB2ID0gdmlkZW9PYmpbbXNnLmluZGV4XTtcbiAgICAgICAgaWYgKHYpIHYubG9vcCA9ICF2Lmxvb3A7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyA9PT0g5oiq5Zu+KGNhbnZhcyDmipPluKcgKyBhIOagh+etvuS4i+i9vSBQTkcpID09PVxuICAgICAgaWYgKG1zZy5NZXNzYWdlID09PSAnc2NyZWVuc2hvdCcpIHtcbiAgICAgICAgY29uc3QgdiA9IHZpZGVvT2JqW21zZy5pbmRleF0gYXMgSFRNTFZpZGVvRWxlbWVudCB8IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKHYgJiYgdi52aWRlb1dpZHRoKSB7XG4gICAgICAgICAgY29uc3QgY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnY2FudmFzJyk7XG4gICAgICAgICAgY2FudmFzLndpZHRoID0gdi52aWRlb1dpZHRoO1xuICAgICAgICAgIGNhbnZhcy5oZWlnaHQgPSB2LnZpZGVvSGVpZ2h0O1xuICAgICAgICAgIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgICAgICAgIGlmIChjdHgpIHtcbiAgICAgICAgICAgIGN0eC5kcmF3SW1hZ2UodiwgMCwgMCk7XG4gICAgICAgICAgICBjYW52YXMudG9CbG9iKChibG9iKSA9PiB7XG4gICAgICAgICAgICAgIGlmICghYmxvYikgcmV0dXJuO1xuICAgICAgICAgICAgICBjb25zdCBibG9iVXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICAgICAgICAgICAgY29uc3QgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgICAgICAgICAgYS5ocmVmID0gYmxvYlVybDtcbiAgICAgICAgICAgICAgYS5kb3dubG9hZCA9IGBjYXQtY2F0Y2gtc2NyZWVuc2hvdC0ke0RhdGUubm93KCl9LnBuZ2A7XG4gICAgICAgICAgICAgIGEuY2xpY2soKTtcbiAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiBVUkwucmV2b2tlT2JqZWN0VVJMKGJsb2JVcmwpLCAxMDAwKTtcbiAgICAgICAgICAgIH0sICdpbWFnZS9wbmcnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vID09PSBmZm1wZWcg5ZCI5bm2KOi/mOWOn+WOnyBjb250ZW50LXNjcmlwdC5qcyBMMTUwLTE3MykgPT09XG4gICAgICAvLyBiYWNrZ3JvdW5kIOWPkSB7TWVzc2FnZTonZmZtcGVnJywgZmlsZXN9IOKGkiBjb250ZW50IHNjcmlwdCDovawgcG9zdE1lc3NhZ2Ug57uZ6aG16Z2iKOWcqOe6vyBmZm1wZWcg5pyN5YqhKVxuICAgICAgaWYgKG1zZy5NZXNzYWdlID09PSAnZmZtcGVnJykge1xuICAgICAgICBpZiAoIW1zZy5maWxlcykge1xuICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZShtc2cpO1xuICAgICAgICAgIHNlbmRSZXNwb25zZSgnb2snKTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBtc2cucXVhbnRpdHkgPz89IG1zZy5maWxlcy5sZW5ndGg7XG4gICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBtc2cuZmlsZXMpIHtcbiAgICAgICAgICBjb25zdCBkYXRhID0geyAuLi5tc2csIC4uLml0ZW0gfTtcbiAgICAgICAgICBkYXRhLnR5cGUgPSBpdGVtLnR5cGUgPz8gJ3ZpZGVvJztcbiAgICAgICAgICBpZiAoZGF0YS5kYXRhIGluc3RhbmNlb2YgQmxvYikge1xuICAgICAgICAgICAgd2luZG93LnBvc3RNZXNzYWdlKGRhdGEpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmZXRjaChkYXRhLmRhdGEpXG4gICAgICAgICAgICAgIC50aGVuKChyKSA9PiByLmJsb2IoKSlcbiAgICAgICAgICAgICAgLnRoZW4oKGJsb2IpID0+IHtcbiAgICAgICAgICAgICAgICBkYXRhLmRhdGEgPSBibG9iO1xuICAgICAgICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZShkYXRhKTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHNlbmRSZXNwb25zZSgnb2snKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIHJldHVybjtcbiAgICB9KTtcblxuICAgIC8vID09PSDnm5HlkKzpobXpnaIgcG9zdE1lc3NhZ2Uo6L+Y5Y6f5Y6fIGNvbnRlbnQtc2NyaXB0LmpzIEwyMzQtMzAyKSA9PT1cbiAgICAvLyDlnKjnur8gZmZtcGVnIOacjeWKoeWPkSBjYXRDYXRjaEZGbXBlZy9jYXRDYXRjaEZGbXBlZ1Jlc3VsdCDihpIg6L2s5Y+R57uZIGJhY2tncm91bmRcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIChldmVudCkgPT4ge1xuICAgICAgY29uc3QgYWN0aW9uID0gWydjYXRDYXRjaEFkZE1lZGlhJywgJ2NhdENhdGNoQWRkS2V5JywgJ2NhdENhdGNoRkZtcGVnJywgJ2NhdENhdGNoRkZtcGVnUmVzdWx0JywgJ2NhdENhdGNoQ2xvc2VTY3JpcHQnXTtcbiAgICAgIGlmICghZXZlbnQuZGF0YSB8fCAhZXZlbnQuZGF0YS5hY3Rpb24gfHwgZXZlbnQub3JpZ2luICE9PSB3aW5kb3cubG9jYXRpb24ub3JpZ2luIHx8ICFhY3Rpb24uaW5jbHVkZXMoZXZlbnQuZGF0YS5hY3Rpb24pKSByZXR1cm47XG4gICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXG4gICAgICAvLyBjYXRDYXRjaEZGbXBlZzrpobXpnaLor7fmsYIgZmZtcGVnIOWQiOW5tiDihpIg6L2s5Y+R57uZIGJhY2tncm91bmRcbiAgICAgIGlmIChldmVudC5kYXRhLmFjdGlvbiA9PT0gJ2NhdENhdGNoRkZtcGVnJykge1xuICAgICAgICBpZiAoIWV2ZW50LmRhdGEudXNlIHx8ICFldmVudC5kYXRhLmZpbGVzIHx8ICFBcnJheS5pc0FycmF5KGV2ZW50LmRhdGEuZmlsZXMpIHx8IGV2ZW50LmRhdGEuZmlsZXMubGVuZ3RoID09PSAwKSByZXR1cm47XG4gICAgICAgIGV2ZW50LmRhdGEudGl0bGUgPSBldmVudC5kYXRhLnRpdGxlID8/IGRvY3VtZW50LnRpdGxlID8/IERhdGUubm93KCkudG9TdHJpbmcoKTtcbiAgICAgICAgZXZlbnQuZGF0YS50aXRsZSA9IGV2ZW50LmRhdGEudGl0bGUucmVwbGFjZUFsbCgnXCInLCAnJykucmVwbGFjZUFsbChcIidcIiwgJycpLnJlcGxhY2VBbGwoJyAnLCAnJyk7XG4gICAgICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgICAgTWVzc2FnZTogZXZlbnQuZGF0YS5hY3Rpb24sXG4gICAgICAgICAgYWN0aW9uOiBldmVudC5kYXRhLnVzZSxcbiAgICAgICAgICBmaWxlczogZXZlbnQuZGF0YS5maWxlcyxcbiAgICAgICAgICB1cmw6IGV2ZW50LmRhdGEuaHJlZiA/PyAoKGV2ZW50LnNvdXJjZSBhcyBXaW5kb3cgfCBudWxsKT8ubG9jYXRpb24/LmhyZWYgPz8gJycpLFxuICAgICAgICAgIC4uLmV2ZW50LmRhdGEsXG4gICAgICAgIH07XG4gICAgICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKGRhdGEpO1xuICAgICAgfVxuXG4gICAgICAvLyBjYXRDYXRjaEZGbXBlZ1Jlc3VsdDpmZm1wZWcg6L2s56CB5a6M5oiQIOKGkiDovazlj5Hnu5kgYmFja2dyb3VuZCDkuIvovb1cbiAgICAgIGlmIChldmVudC5kYXRhLmFjdGlvbiA9PT0gJ2NhdENhdGNoRkZtcGVnUmVzdWx0Jykge1xuICAgICAgICBpZiAoIWV2ZW50LmRhdGEuc3RhdGUgfHwgIWV2ZW50LmRhdGEudGFiSWQpIHJldHVybjtcbiAgICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoeyBNZXNzYWdlOiAnY2F0Q2F0Y2hGRm1wZWdSZXN1bHQnLCAuLi5ldmVudC5kYXRhIH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBjYXRDYXRjaENsb3NlU2NyaXB0Oumhtemdouivt+axguWFs+mXreiEmuacrCDihpIg6L2s5Y+R57uZIGJhY2tncm91bmRcbiAgICAgIGlmIChldmVudC5kYXRhLmFjdGlvbiA9PT0gJ2NhdENhdGNoQ2xvc2VTY3JpcHQnKSB7XG4gICAgICAgIGlmICghZXZlbnQuZGF0YS5zY3JpcHQgfHwgIWV2ZW50LmlzVHJ1c3RlZCkgcmV0dXJuO1xuICAgICAgICBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZSh7IE1lc3NhZ2U6ICdjbG9zZVNjcmlwdCcsIC4uLmV2ZW50LmRhdGEgfSk7XG4gICAgICB9XG4gICAgfSwgeyBjYXB0dXJlOiB0cnVlIH0pO1xuICB9LFxufSk7XG4iLCIvLyNyZWdpb24gc3JjL3V0aWxzL2ludGVybmFsL2xvZ2dlci50c1xuZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG5cdGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcblx0aWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSBtZXRob2QoYFt3eHRdICR7YXJncy5zaGlmdCgpfWAsIC4uLmFyZ3MpO1xuXHRlbHNlIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xufVxuLyoqIFdyYXBwZXIgYXJvdW5kIGBjb25zb2xlYCB3aXRoIGEgXCJbd3h0XVwiIHByZWZpeCAqL1xuY29uc3QgbG9nZ2VyID0ge1xuXHRkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuXHRsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG5cdHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuXHRlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBsb2dnZXIgfTtcbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgYnJvd3NlciQxIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbi8vI3JlZ2lvbiBzcmMvYnJvd3Nlci50c1xuLyoqXG4qIENvbnRhaW5zIHRoZSBgYnJvd3NlcmAgZXhwb3J0IHdoaWNoIHlvdSBzaG91bGQgdXNlIHRvIGFjY2VzcyB0aGUgZXh0ZW5zaW9uXG4qIEFQSXMgaW4geW91ciBwcm9qZWN0OlxuKlxuKiBgYGB0c1xuKiBpbXBvcnQgeyBicm93c2VyIH0gZnJvbSAnd3h0L2Jyb3dzZXInO1xuKlxuKiBicm93c2VyLnJ1bnRpbWUub25JbnN0YWxsZWQuYWRkTGlzdGVuZXIoKCkgPT4ge1xuKiAgIC8vIC4uLlxuKiB9KTtcbiogYGBgXG4qXG4qIEBtb2R1bGUgd3h0L2Jyb3dzZXJcbiovXG5jb25zdCBicm93c2VyID0gYnJvd3NlciQxO1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBicm93c2VyIH07XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG4vLyNyZWdpb24gc3JjL3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMudHNcbnZhciBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50ID0gY2xhc3MgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCBleHRlbmRzIEV2ZW50IHtcblx0c3RhdGljIEVWRU5UX05BTUUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIik7XG5cdGNvbnN0cnVjdG9yKG5ld1VybCwgb2xkVXJsKSB7XG5cdFx0c3VwZXIoV3h0TG9jYXRpb25DaGFuZ2VFdmVudC5FVkVOVF9OQU1FLCB7fSk7XG5cdFx0dGhpcy5uZXdVcmwgPSBuZXdVcmw7XG5cdFx0dGhpcy5vbGRVcmwgPSBvbGRVcmw7XG5cdH1cbn07XG4vKipcbiogUmV0dXJucyBhbiBldmVudCBuYW1lIHVuaXF1ZSB0byB0aGUgZXh0ZW5zaW9uIGFuZCBjb250ZW50IHNjcmlwdCB0aGF0J3NcbiogcnVubmluZy5cbiovXG5mdW5jdGlvbiBnZXRVbmlxdWVFdmVudE5hbWUoZXZlbnROYW1lKSB7XG5cdHJldHVybiBgJHticm93c2VyPy5ydW50aW1lPy5pZH06JHtpbXBvcnQubWV0YS5lbnYuRU5UUllQT0lOVH06JHtldmVudE5hbWV9YDtcbn1cbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCwgZ2V0VW5pcXVlRXZlbnROYW1lIH07XG4iLCJpbXBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSBcIi4vY3VzdG9tLWV2ZW50cy5tanNcIjtcbi8vI3JlZ2lvbiBzcmMvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci50c1xuY29uc3Qgc3VwcG9ydHNOYXZpZ2F0aW9uQXBpID0gdHlwZW9mIGdsb2JhbFRoaXMubmF2aWdhdGlvbj8uYWRkRXZlbnRMaXN0ZW5lciA9PT0gXCJmdW5jdGlvblwiO1xuLyoqXG4qIENyZWF0ZSBhIHV0aWwgdGhhdCB3YXRjaGVzIGZvciBVUkwgY2hhbmdlcywgZGlzcGF0Y2hpbmcgdGhlIGN1c3RvbSBldmVudCB3aGVuXG4qIGRldGVjdGVkLiBTdG9wcyB3YXRjaGluZyB3aGVuIGNvbnRlbnQgc2NyaXB0IGlzIGludmFsaWRhdGVkLiBVc2VzIE5hdmlnYXRpb25cbiogQVBJIHdoZW4gYXZhaWxhYmxlLCBvdGhlcndpc2UgZmFsbHMgYmFjayB0byBwb2xsaW5nLlxuKi9cbmZ1bmN0aW9uIGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcihjdHgpIHtcblx0bGV0IGxhc3RVcmw7XG5cdGxldCB3YXRjaGluZyA9IGZhbHNlO1xuXHRyZXR1cm4geyBydW4oKSB7XG5cdFx0aWYgKHdhdGNoaW5nKSByZXR1cm47XG5cdFx0d2F0Y2hpbmcgPSB0cnVlO1xuXHRcdGxhc3RVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuXHRcdGlmIChzdXBwb3J0c05hdmlnYXRpb25BcGkpIGdsb2JhbFRoaXMubmF2aWdhdGlvbi5hZGRFdmVudExpc3RlbmVyKFwibmF2aWdhdGVcIiwgKGV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBuZXdVcmwgPSBuZXcgVVJMKGV2ZW50LmRlc3RpbmF0aW9uLnVybCk7XG5cdFx0XHRpZiAobmV3VXJsLmhyZWYgPT09IGxhc3RVcmwuaHJlZikgcmV0dXJuO1xuXHRcdFx0d2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBsYXN0VXJsKSk7XG5cdFx0XHRsYXN0VXJsID0gbmV3VXJsO1xuXHRcdH0sIHsgc2lnbmFsOiBjdHguc2lnbmFsIH0pO1xuXHRcdGVsc2UgY3R4LnNldEludGVydmFsKCgpID0+IHtcblx0XHRcdGNvbnN0IG5ld1VybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG5cdFx0XHRpZiAobmV3VXJsLmhyZWYgIT09IGxhc3RVcmwuaHJlZikge1xuXHRcdFx0XHR3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIGxhc3RVcmwpKTtcblx0XHRcdFx0bGFzdFVybCA9IG5ld1VybDtcblx0XHRcdH1cblx0XHR9LCAxZTMpO1xuXHR9IH07XG59XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9O1xuIiwiaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHsgZ2V0VW5pcXVlRXZlbnROYW1lIH0gZnJvbSBcIi4vaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanNcIjtcbmltcG9ydCB7IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlciB9IGZyb20gXCIuL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzXCI7XG5pbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG4vLyNyZWdpb24gc3JjL3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQudHNcbi8qKlxuKiBJbXBsZW1lbnRzXG4qIFtgQWJvcnRDb250cm9sbGVyYF0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0Fib3J0Q29udHJvbGxlcikuXG4qIFVzZWQgdG8gZGV0ZWN0IGFuZCBzdG9wIGNvbnRlbnQgc2NyaXB0IGNvZGUgd2hlbiB0aGUgc2NyaXB0IGlzIGludmFsaWRhdGVkLlxuKlxuKiBJdCBhbHNvIHByb3ZpZGVzIHNldmVyYWwgdXRpbGl0aWVzIGxpa2UgYGN0eC5zZXRUaW1lb3V0YCBhbmRcbiogYGN0eC5zZXRJbnRlcnZhbGAgdGhhdCBzaG91bGQgYmUgdXNlZCBpbiBjb250ZW50IHNjcmlwdHMgaW5zdGVhZCBvZlxuKiBgd2luZG93LnNldFRpbWVvdXRgIG9yIGB3aW5kb3cuc2V0SW50ZXJ2YWxgLlxuKlxuKiBUbyBjcmVhdGUgY29udGV4dCBmb3IgdGVzdGluZywgeW91IGNhbiB1c2UgdGhlIGNsYXNzJ3MgY29uc3RydWN0b3I6XG4qXG4qIGBgYHRzXG4qIGltcG9ydCB7IENvbnRlbnRTY3JpcHRDb250ZXh0IH0gZnJvbSAnd3h0L3V0aWxzL2NvbnRlbnQtc2NyaXB0cy1jb250ZXh0JztcbipcbiogdGVzdCgnc3RvcmFnZSBsaXN0ZW5lciBzaG91bGQgYmUgcmVtb3ZlZCB3aGVuIGNvbnRleHQgaXMgaW52YWxpZGF0ZWQnLCAoKSA9PiB7XG4qICAgY29uc3QgY3R4ID0gbmV3IENvbnRlbnRTY3JpcHRDb250ZXh0KCd0ZXN0Jyk7XG4qICAgY29uc3QgaXRlbSA9IHN0b3JhZ2UuZGVmaW5lSXRlbSgnbG9jYWw6Y291bnQnLCB7IGRlZmF1bHRWYWx1ZTogMCB9KTtcbiogICBjb25zdCB3YXRjaGVyID0gdmkuZm4oKTtcbipcbiogICBjb25zdCB1bndhdGNoID0gaXRlbS53YXRjaCh3YXRjaGVyKTtcbiogICBjdHgub25JbnZhbGlkYXRlZCh1bndhdGNoKTsgLy8gTGlzdGVuIGZvciBpbnZhbGlkYXRlIGhlcmVcbipcbiogICBhd2FpdCBpdGVtLnNldFZhbHVlKDEpO1xuKiAgIGV4cGVjdCh3YXRjaGVyKS50b0JlQ2FsbGVkVGltZXMoMSk7XG4qICAgZXhwZWN0KHdhdGNoZXIpLnRvQmVDYWxsZWRXaXRoKDEsIDApO1xuKlxuKiAgIGN0eC5ub3RpZnlJbnZhbGlkYXRlZCgpOyAvLyBVc2UgdGhpcyBmdW5jdGlvbiB0byBpbnZhbGlkYXRlIHRoZSBjb250ZXh0XG4qICAgYXdhaXQgaXRlbS5zZXRWYWx1ZSgyKTtcbiogICBleHBlY3Qod2F0Y2hlcikudG9CZUNhbGxlZFRpbWVzKDEpO1xuKiB9KTtcbiogYGBgXG4qL1xudmFyIENvbnRlbnRTY3JpcHRDb250ZXh0ID0gY2xhc3MgQ29udGVudFNjcmlwdENvbnRleHQge1xuXHRzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIik7XG5cdGlkO1xuXHRhYm9ydENvbnRyb2xsZXI7XG5cdGxvY2F0aW9uV2F0Y2hlciA9IGNyZWF0ZUxvY2F0aW9uV2F0Y2hlcih0aGlzKTtcblx0Y29uc3RydWN0b3IoY29udGVudFNjcmlwdE5hbWUsIG9wdGlvbnMpIHtcblx0XHR0aGlzLmNvbnRlbnRTY3JpcHROYW1lID0gY29udGVudFNjcmlwdE5hbWU7XG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucztcblx0XHR0aGlzLmlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMik7XG5cdFx0dGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG5cdFx0dGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuXHRcdHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCk7XG5cdH1cblx0Z2V0IHNpZ25hbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuc2lnbmFsO1xuXHR9XG5cdGFib3J0KHJlYXNvbikge1xuXHRcdHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5hYm9ydChyZWFzb24pO1xuXHR9XG5cdGdldCBpc0ludmFsaWQoKSB7XG5cdFx0aWYgKGJyb3dzZXIucnVudGltZT8uaWQgPT0gbnVsbCkgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuXHRcdHJldHVybiB0aGlzLnNpZ25hbC5hYm9ydGVkO1xuXHR9XG5cdGdldCBpc1ZhbGlkKCkge1xuXHRcdHJldHVybiAhdGhpcy5pc0ludmFsaWQ7XG5cdH1cblx0LyoqXG5cdCogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzXG5cdCogaW52YWxpZGF0ZWQuXG5cdCpcblx0KiBAZXhhbXBsZVxuXHQqICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihjYik7XG5cdCogICBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuXHQqICAgICBicm93c2VyLnJ1bnRpbWUub25NZXNzYWdlLnJlbW92ZUxpc3RlbmVyKGNiKTtcblx0KiAgIH0pO1xuXHQqICAgLy8gLi4uXG5cdCogICByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyKCk7XG5cdCpcblx0KiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG5cdCovXG5cdG9uSW52YWxpZGF0ZWQoY2IpIHtcblx0XHR0aGlzLnNpZ25hbC5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuXHRcdHJldHVybiAoKSA9PiB0aGlzLnNpZ25hbC5yZW1vdmVFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgY2IpO1xuXHR9XG5cdC8qKlxuXHQqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uXG5cdCogdGhhdCBzaG91bGRuJ3QgcnVuIGFmdGVyIHRoZSBjb250ZXh0IGlzIGV4cGlyZWQuXG5cdCpcblx0KiBAZXhhbXBsZVxuXHQqICAgY29uc3QgZ2V0VmFsdWVGcm9tU3RvcmFnZSA9IGFzeW5jICgpID0+IHtcblx0KiAgICAgaWYgKGN0eC5pc0ludmFsaWQpIHJldHVybiBjdHguYmxvY2soKTtcblx0KlxuXHQqICAgICAvLyAuLi5cblx0KiAgIH07XG5cdCovXG5cdGJsb2NrKCkge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7fSk7XG5cdH1cblx0LyoqXG5cdCogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRJbnRlcnZhbGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWxcblx0KiB3aGVuIGludmFsaWRhdGVkLlxuXHQqXG5cdCogSW50ZXJ2YWxzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2xlYXJJbnRlcnZhbGAgZnVuY3Rpb24uXG5cdCovXG5cdHNldEludGVydmFsKGhhbmRsZXIsIHRpbWVvdXQpIHtcblx0XHRjb25zdCBpZCA9IHNldEludGVydmFsKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmlzVmFsaWQpIGhhbmRsZXIoKTtcblx0XHR9LCB0aW1lb3V0KTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2xlYXJJbnRlcnZhbChpZCkpO1xuXHRcdHJldHVybiBpZDtcblx0fVxuXHQvKipcblx0KiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsXG5cdCogd2hlbiBpbnZhbGlkYXRlZC5cblx0KlxuXHQqIFRpbWVvdXRzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgc2V0VGltZW91dGAgZnVuY3Rpb24uXG5cdCovXG5cdHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuXHRcdGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG5cdFx0fSwgdGltZW91dCk7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuXHRcdHJldHVybiBpZDtcblx0fVxuXHQvKipcblx0KiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZWAgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHNcblx0KiB0aGUgcmVxdWVzdCB3aGVuIGludmFsaWRhdGVkLlxuXHQqXG5cdCogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbEFuaW1hdGlvbkZyYW1lYFxuXHQqIGZ1bmN0aW9uLlxuXHQqL1xuXHRyZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcblx0XHRjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuXHRcdFx0aWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG5cdFx0fSk7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cdC8qKlxuXHQqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFja2AgdGhhdCBhdXRvbWF0aWNhbGx5IGNhbmNlbHMgdGhlXG5cdCogcmVxdWVzdCB3aGVuIGludmFsaWRhdGVkLlxuXHQqXG5cdCogQ2FsbGJhY2tzIGNhbiBiZSBjYW5jZWxlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNhbmNlbElkbGVDYWxsYmFja2Bcblx0KiBmdW5jdGlvbi5cblx0Ki9cblx0cmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuXHRcdGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuXHRcdFx0aWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcblx0XHR9LCBvcHRpb25zKTtcblx0XHR0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cdGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG5cdFx0aWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcblx0XHRcdGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuXHRcdH1cblx0XHR0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKHR5cGUuc3RhcnRzV2l0aChcInd4dDpcIikgPyBnZXRVbmlxdWVFdmVudE5hbWUodHlwZSkgOiB0eXBlLCBoYW5kbGVyLCB7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0c2lnbmFsOiB0aGlzLnNpZ25hbFxuXHRcdH0pO1xuXHR9XG5cdC8qKlxuXHQqIEBpbnRlcm5hbFxuXHQqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuXHQqL1xuXHRub3RpZnlJbnZhbGlkYXRlZCgpIHtcblx0XHR0aGlzLmFib3J0KFwiQ29udGVudCBzY3JpcHQgY29udGV4dCBpbnZhbGlkYXRlZFwiKTtcblx0XHRsb2dnZXIuZGVidWcoYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgKTtcblx0fVxuXHRzdG9wT2xkU2NyaXB0cygpIHtcblx0XHRkb2N1bWVudC5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudChDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsIHsgZGV0YWlsOiB7XG5cdFx0XHRjb250ZW50U2NyaXB0TmFtZTogdGhpcy5jb250ZW50U2NyaXB0TmFtZSxcblx0XHRcdG1lc3NhZ2VJZDogdGhpcy5pZFxuXHRcdH0gfSkpO1xuXHRcdGlmICghdGhpcy5vcHRpb25zPy5ub1NjcmlwdFN0YXJ0ZWRQb3N0TWVzc2FnZSkgd2luZG93LnBvc3RNZXNzYWdlKHtcblx0XHRcdHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcblx0XHRcdGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuXHRcdFx0bWVzc2FnZUlkOiB0aGlzLmlkXG5cdFx0fSwgXCIqXCIpO1xuXHR9XG5cdHZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkge1xuXHRcdGNvbnN0IGlzU2FtZUNvbnRlbnRTY3JpcHQgPSBldmVudC5kZXRhaWw/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuXHRcdGNvbnN0IGlzRnJvbVNlbGYgPSBldmVudC5kZXRhaWw/Lm1lc3NhZ2VJZCA9PT0gdGhpcy5pZDtcblx0XHRyZXR1cm4gaXNTYW1lQ29udGVudFNjcmlwdCAmJiAhaXNGcm9tU2VsZjtcblx0fVxuXHRsaXN0ZW5Gb3JOZXdlclNjcmlwdHMoKSB7XG5cdFx0Y29uc3QgY2IgPSAoZXZlbnQpID0+IHtcblx0XHRcdGlmICghKGV2ZW50IGluc3RhbmNlb2YgQ3VzdG9tRXZlbnQpIHx8ICF0aGlzLnZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkpIHJldHVybjtcblx0XHRcdHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcblx0XHR9O1xuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLCBjYik7XG5cdFx0dGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFLCBjYikpO1xuXHR9XG59O1xuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyBDb250ZW50U2NyaXB0Q29udGV4dCB9O1xuIl0sIm5hbWVzIjpbImRlZmluaXRpb24iLCJfYiIsIl9hIiwicHJpbnQiLCJsb2dnZXIiLCJicm93c2VyIiwiV3h0TG9jYXRpb25DaGFuZ2VFdmVudCJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQ0EsV0FBUyxvQkFBb0JBLGFBQVk7QUFDeEMsV0FBT0E7QUFBQSxFQUNSO0FDTUEsUUFBQSxhQUFlLG9CQUFvQjtBQUFBLElBQ2pDLFNBQVMsQ0FBQyxlQUFlLFlBQVk7QUFBQSxJQUNyQyxPQUFPO0FBQUEsSUFDUCxXQUFXO0FBQUEsSUFDWCxPQUFPO0FBQ0wsVUFBSSxXQUErQixDQUFBO0FBQ25DLFVBQUksV0FBcUIsQ0FBQTtBQUV6QixhQUFPLFFBQVEsVUFBVSxZQUFZLENBQUMsS0FBSyxTQUFTLGlCQUFpQjtBQUNuRSxZQUFJLE9BQU8sUUFBUSxVQUFXO0FBRzlCLFlBQUksSUFBSSxZQUFZLGlCQUFpQjtBQUNuQyxnQkFBTSxTQUE2QixDQUFBO0FBQ25DLGdCQUFNLFNBQW1CLENBQUE7QUFDekIsbUJBQVMsaUJBQW1DLGNBQWMsRUFBRSxRQUFRLENBQUMsT0FBTztBQUMxRSxnQkFBSSxHQUFHLFlBQVk7QUFDakIscUJBQU8sS0FBSyxFQUFFO0FBQ2QscUJBQU8sS0FBSyxHQUFHLFVBQVU7QUFBQSxZQUMzQjtBQUFBLFVBQ0YsQ0FBQztBQUNELG1CQUFTLGlCQUFvQyxRQUFRLEVBQUUsUUFBUSxDQUFDLFdBQVc7QUFDekUsZ0JBQUksQ0FBQyxPQUFPLGdCQUFpQjtBQUM3QixtQkFBTyxnQkFDSixpQkFBbUMsY0FBYyxFQUNqRCxRQUFRLENBQUMsT0FBTztBQUNmLGtCQUFJLEdBQUcsWUFBWTtBQUNqQix1QkFBTyxLQUFLLEVBQUU7QUFDZCx1QkFBTyxLQUFLLEdBQUcsVUFBVTtBQUFBLGNBQzNCO0FBQUEsWUFDRixDQUFDO0FBQUEsVUFDTCxDQUFDO0FBRUQsY0FBSSxPQUFPLFNBQVMsR0FBRztBQUNyQixnQkFBSSxPQUFPLFdBQVcsU0FBUyxVQUFVLE9B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QUFPO0FBQUEsSUFDUjtBQUFBLElBQ0EsaUJBQWlCLFFBQVEsTUFBTSxTQUFTLFNBQVM7O0FBQ2hELFVBQUksU0FBUyxzQkFBc0I7QUFDbEMsWUFBSSxLQUFLLFFBQVMsTUFBSyxnQkFBZ0IsSUFBRztBQUFBLE1BQzNDO0FBQ0EsT0FBQUEsTUFBQSxPQUFPLHFCQUFQLGdCQUFBQSxJQUFBLGFBQTBCLEtBQUssV0FBVyxNQUFNLElBQUksbUJBQW1CLElBQUksSUFBSSxNQUFNLFNBQVM7QUFBQSxRQUM3RixHQUFHO0FBQUEsUUFDSCxRQUFRLEtBQUs7QUFBQSxNQUNoQjtBQUFBLElBQ0M7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBS0Esb0JBQW9CO0FBQ25CLFdBQUssTUFBTSxvQ0FBb0M7QUFDL0NFLGVBQU8sTUFBTSxtQkFBbUIsS0FBSyxpQkFBaUIsdUJBQXVCO0FBQUEsSUFDOUU7QUFBQSxJQUNBLGlCQUFpQjs7QUFDaEIsZUFBUyxjQUFjLElBQUksWUFBWSxHQUFxQiw2QkFBNkIsRUFBRSxRQUFRO0FBQUEsUUFDbEcsbUJBQW1CLEtBQUs7QUFBQSxRQUN4QixXQUFXLEtBQUs7QUFBQSxNQUNuQixFQUFHLENBQUUsQ0FBQztBQUNKLFVBQUksR0FBQ0YsTUFBQSxLQUFLLFlBQUwsZ0JBQUFBLElBQWMsNEJBQTRCLFFBQU8sWUFBWTtBQUFBLFFBQ2pFLE1BQU0sR0FBcUI7QUFBQSxRQUMzQixtQkFBbUIsS0FBSztBQUFBLFFBQ3hCLFdBQVcsS0FBSztBQUFBLE1BQ25CLEdBQUssR0FBRztBQUFBLElBQ1A7QUFBQSxJQUNBLHlCQUF5QixPQUFPOztBQUMvQixZQUFNLHdCQUFzQkEsTUFBQSxNQUFNLFdBQU4sZ0JBQUFBLElBQWMsdUJBQXNCLEtBQUs7QUFDckUsWUFBTSxlQUFhRCxNQUFBLE1BQU0sV0FBTixnQkFBQUEsSUFBYyxlQUFjLEtBQUs7QUFDcEQsYUFBTyx1QkFBdUIsQ0FBQztBQUFBLElBQ2hDO0FBQUEsSUFDQSx3QkFBd0I7QUFDdkIsWUFBTSxLQUFLLENBQUMsVUFBVTtBQUNyQixZQUFJLEVBQUUsaUJBQWlCLGdCQUFnQixDQUFDLEtBQUsseUJBQXlCLEtBQUssRUFBRztBQUM5RSxhQUFLLGtCQUFpQjtBQUFBLE1BQ3ZCO0FBQ0EsZUFBUyxpQkFBaUIsR0FBcUIsNkJBQTZCLEVBQUU7QUFDOUUsV0FBSyxjQUFjLE1BQU0sU0FBUyxvQkFBb0IsR0FBcUIsNkJBQTZCLEVBQUUsQ0FBQztBQUFBLElBQzVHO0FBQUEsRUFDRCxHQXhKQyxjQUQwQixJQUNuQiwrQkFBOEIsbUJBQW1CLDRCQUE0QixJQUQxRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCwyLDMsNCw1LDYsN119
