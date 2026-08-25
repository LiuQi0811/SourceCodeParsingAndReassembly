(function polyfill() {
  const relList = document.createElement("link").relList;
  if (relList && relList.supports && relList.supports("modulepreload")) {
    return;
  }
  for (const link of document.querySelectorAll('link[rel="modulepreload"]')) {
    processPreload(link);
  }
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== "childList") {
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node.tagName === "LINK" && node.rel === "modulepreload")
          processPreload(node);
      }
    }
  }).observe(document, { childList: true, subtree: true });
  function getFetchOpts(link) {
    const fetchOpts = {};
    if (link.integrity) fetchOpts.integrity = link.integrity;
    if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
    if (link.crossOrigin === "use-credentials")
      fetchOpts.credentials = "include";
    else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
    else fetchOpts.credentials = "same-origin";
    return fetchOpts;
  }
  function processPreload(link) {
    if (link.ep)
      return;
    link.ep = true;
    const fetchOpts = getFetchOpts(link);
    fetch(link.href, fetchOpts);
  }
})();
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
let ws;
function getDevServerWebSocket() {
  if (ws == null) {
    const serverUrl = "ws://localhost:3000";
    logger.debug("Connecting to dev server @", serverUrl);
    ws = new WebSocket(serverUrl, "vite-hmr");
    ws.addWxtEventListener = ws.addEventListener.bind(ws);
    ws.sendCustom = (event, payload) => ws == null ? void 0 : ws.send(JSON.stringify({
      type: "custom",
      event,
      payload
    }));
    ws.addEventListener("open", () => {
      logger.debug("Connected to dev server");
    });
    ws.addEventListener("close", () => {
      logger.debug("Disconnected from dev server");
    });
    ws.addEventListener("error", (event) => {
      logger.error("Failed to connect to dev server", event);
    });
    ws.addEventListener("message", (e) => {
      try {
        const message = JSON.parse(e.data);
        if (message.type === "custom") ws == null ? void 0 : ws.dispatchEvent(new CustomEvent(message.event, { detail: message.data }));
      } catch (err) {
        logger.error("Failed to handle message", err);
      }
    });
  }
  return ws;
}
try {
  getDevServerWebSocket().addWxtEventListener("wxt:reload-page", (event) => {
    if (event.detail === location.pathname.substring(1)) location.reload();
  });
} catch (err) {
  logger.error("Failed to setup web socket connection with dev server", err);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVsb2FkLWh0bWwtQ2pGNEZlalcuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMS40X3R5cGVzY3JpcHRANS45LjNfdml0ZUA2LjQuMy9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdmlydHVhbC9yZWxvYWQtaHRtbC5tanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8jcmVnaW9uIHNyYy91dGlscy9pbnRlcm5hbC9sb2dnZXIudHNcbmZ1bmN0aW9uIHByaW50KG1ldGhvZCwgLi4uYXJncykge1xuXHRpZiAoaW1wb3J0Lm1ldGEuZW52Lk1PREUgPT09IFwicHJvZHVjdGlvblwiKSByZXR1cm47XG5cdGlmICh0eXBlb2YgYXJnc1swXSA9PT0gXCJzdHJpbmdcIikgbWV0aG9kKGBbd3h0XSAke2FyZ3Muc2hpZnQoKX1gLCAuLi5hcmdzKTtcblx0ZWxzZSBtZXRob2QoXCJbd3h0XVwiLCAuLi5hcmdzKTtcbn1cbi8qKiBXcmFwcGVyIGFyb3VuZCBgY29uc29sZWAgd2l0aCBhIFwiW3d4dF1cIiBwcmVmaXggKi9cbmNvbnN0IGxvZ2dlciA9IHtcblx0ZGVidWc6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmRlYnVnLCAuLi5hcmdzKSxcblx0bG9nOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5sb2csIC4uLmFyZ3MpLFxuXHR3YXJuOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS53YXJuLCAuLi5hcmdzKSxcblx0ZXJyb3I6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmVycm9yLCAuLi5hcmdzKVxufTtcbi8vI2VuZHJlZ2lvblxuLy8jcmVnaW9uIHNyYy91dGlscy9pbnRlcm5hbC9kZXYtc2VydmVyLXdlYnNvY2tldC50c1xubGV0IHdzO1xuLyoqIENvbm5lY3QgdG8gdGhlIHdlYnNvY2tldCBhbmQgbGlzdGVuIGZvciBtZXNzYWdlcy4gKi9cbmZ1bmN0aW9uIGdldERldlNlcnZlcldlYlNvY2tldCgpIHtcblx0aWYgKGltcG9ydC5tZXRhLmVudi5DT01NQU5EICE9PSBcInNlcnZlXCIpIHRocm93IEVycm9yKFwiTXVzdCBiZSBydW5uaW5nIFdYVCBkZXYgY29tbWFuZCB0byBjb25uZWN0IHRvIGNhbGwgZ2V0RGV2U2VydmVyV2ViU29ja2V0KClcIik7XG5cdGlmICh3cyA9PSBudWxsKSB7XG5cdFx0Y29uc3Qgc2VydmVyVXJsID0gX19ERVZfU0VSVkVSX09SSUdJTl9fO1xuXHRcdGxvZ2dlci5kZWJ1ZyhcIkNvbm5lY3RpbmcgdG8gZGV2IHNlcnZlciBAXCIsIHNlcnZlclVybCk7XG5cdFx0d3MgPSBuZXcgV2ViU29ja2V0KHNlcnZlclVybCwgXCJ2aXRlLWhtclwiKTtcblx0XHR3cy5hZGRXeHRFdmVudExpc3RlbmVyID0gd3MuYWRkRXZlbnRMaXN0ZW5lci5iaW5kKHdzKTtcblx0XHR3cy5zZW5kQ3VzdG9tID0gKGV2ZW50LCBwYXlsb2FkKSA9PiB3cz8uc2VuZChKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHR0eXBlOiBcImN1c3RvbVwiLFxuXHRcdFx0ZXZlbnQsXG5cdFx0XHRwYXlsb2FkXG5cdFx0fSkpO1xuXHRcdHdzLmFkZEV2ZW50TGlzdGVuZXIoXCJvcGVuXCIsICgpID0+IHtcblx0XHRcdGxvZ2dlci5kZWJ1ZyhcIkNvbm5lY3RlZCB0byBkZXYgc2VydmVyXCIpO1xuXHRcdH0pO1xuXHRcdHdzLmFkZEV2ZW50TGlzdGVuZXIoXCJjbG9zZVwiLCAoKSA9PiB7XG5cdFx0XHRsb2dnZXIuZGVidWcoXCJEaXNjb25uZWN0ZWQgZnJvbSBkZXYgc2VydmVyXCIpO1xuXHRcdH0pO1xuXHRcdHdzLmFkZEV2ZW50TGlzdGVuZXIoXCJlcnJvclwiLCAoZXZlbnQpID0+IHtcblx0XHRcdGxvZ2dlci5lcnJvcihcIkZhaWxlZCB0byBjb25uZWN0IHRvIGRldiBzZXJ2ZXJcIiwgZXZlbnQpO1xuXHRcdH0pO1xuXHRcdHdzLmFkZEV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIChlKSA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBtZXNzYWdlID0gSlNPTi5wYXJzZShlLmRhdGEpO1xuXHRcdFx0XHRpZiAobWVzc2FnZS50eXBlID09PSBcImN1c3RvbVwiKSB3cz8uZGlzcGF0Y2hFdmVudChuZXcgQ3VzdG9tRXZlbnQobWVzc2FnZS5ldmVudCwgeyBkZXRhaWw6IG1lc3NhZ2UuZGF0YSB9KSk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0bG9nZ2VyLmVycm9yKFwiRmFpbGVkIHRvIGhhbmRsZSBtZXNzYWdlXCIsIGVycik7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblx0cmV0dXJuIHdzO1xufVxuLy8jZW5kcmVnaW9uXG4vLyNyZWdpb24gc3JjL3ZpcnR1YWwvcmVsb2FkLWh0bWwudHNcbmlmIChpbXBvcnQubWV0YS5lbnYuQ09NTUFORCA9PT0gXCJzZXJ2ZVwiKSB0cnkge1xuXHRnZXREZXZTZXJ2ZXJXZWJTb2NrZXQoKS5hZGRXeHRFdmVudExpc3RlbmVyKFwid3h0OnJlbG9hZC1wYWdlXCIsIChldmVudCkgPT4ge1xuXHRcdGlmIChldmVudC5kZXRhaWwgPT09IGxvY2F0aW9uLnBhdGhuYW1lLnN1YnN0cmluZygxKSkgbG9jYXRpb24ucmVsb2FkKCk7XG5cdH0pO1xufSBjYXRjaCAoZXJyKSB7XG5cdGxvZ2dlci5lcnJvcihcIkZhaWxlZCB0byBzZXR1cCB3ZWIgc29ja2V0IGNvbm5lY3Rpb24gd2l0aCBkZXYgc2VydmVyXCIsIGVycik7XG59XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7fTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsU0FBUyxNQUFNLFdBQVcsTUFBTTtBQUUvQixNQUFJLE9BQU8sS0FBSyxDQUFDLE1BQU0sU0FBVSxRQUFPLFNBQVMsS0FBSyxNQUFBLENBQU8sSUFBSSxHQUFHLElBQUk7QUFBQSxNQUNuRSxRQUFPLFNBQVMsR0FBRyxJQUFJO0FBQzdCO0FBRUEsTUFBTSxTQUFTO0FBQUEsRUFDZCxPQUFPLElBQUksU0FBUyxNQUFNLFFBQVEsT0FBTyxHQUFHLElBQUk7QUFBQSxFQUNoRCxLQUFLLElBQUksU0FBUyxNQUFNLFFBQVEsS0FBSyxHQUFHLElBQUk7QUFBQSxFQUM1QyxNQUFNLElBQUksU0FBUyxNQUFNLFFBQVEsTUFBTSxHQUFHLElBQUk7QUFBQSxFQUM5QyxPQUFPLElBQUksU0FBUyxNQUFNLFFBQVEsT0FBTyxHQUFHLElBQUk7QUFDakQ7QUFHQSxJQUFJO0FBRUosU0FBUyx3QkFBd0I7QUFFaEMsTUFBSSxNQUFNLE1BQU07QUFDZixVQUFNLFlBQVk7QUFDbEIsV0FBTyxNQUFNLDhCQUE4QixTQUFTO0FBQ3BELFNBQUssSUFBSSxVQUFVLFdBQVcsVUFBVTtBQUN4QyxPQUFHLHNCQUFzQixHQUFHLGlCQUFpQixLQUFLLEVBQUU7QUFDcEQsT0FBRyxhQUFhLENBQUMsT0FBTyxZQUFZLHlCQUFJLEtBQUssS0FBSyxVQUFVO0FBQUEsTUFDM0QsTUFBTTtBQUFBLE1BQ047QUFBQSxNQUNBO0FBQUEsSUFBQSxDQUNBO0FBQ0QsT0FBRyxpQkFBaUIsUUFBUSxNQUFNO0FBQ2pDLGFBQU8sTUFBTSx5QkFBeUI7QUFBQSxJQUN2QyxDQUFDO0FBQ0QsT0FBRyxpQkFBaUIsU0FBUyxNQUFNO0FBQ2xDLGFBQU8sTUFBTSw4QkFBOEI7QUFBQSxJQUM1QyxDQUFDO0FBQ0QsT0FBRyxpQkFBaUIsU0FBUyxDQUFDLFVBQVU7QUFDdkMsYUFBTyxNQUFNLG1DQUFtQyxLQUFLO0FBQUEsSUFDdEQsQ0FBQztBQUNELE9BQUcsaUJBQWlCLFdBQVcsQ0FBQyxNQUFNO0FBQ3JDLFVBQUk7QUFDSCxjQUFNLFVBQVUsS0FBSyxNQUFNLEVBQUUsSUFBSTtBQUNqQyxZQUFJLFFBQVEsU0FBUyxTQUFVLDBCQUFJLGNBQWMsSUFBSSxZQUFZLFFBQVEsT0FBTyxFQUFFLFFBQVEsUUFBUSxLQUFBLENBQU07QUFBQSxNQUN6RyxTQUFTLEtBQUs7QUFDYixlQUFPLE1BQU0sNEJBQTRCLEdBQUc7QUFBQSxNQUM3QztBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFDQSxTQUFPO0FBQ1I7QUFHeUMsSUFBSTtBQUM1QywwQkFBd0Isb0JBQW9CLG1CQUFtQixDQUFDLFVBQVU7QUFDekUsUUFBSSxNQUFNLFdBQVcsU0FBUyxTQUFTLFVBQVUsQ0FBQyxZQUFZLE9BQUE7QUFBQSxFQUMvRCxDQUFDO0FBQ0YsU0FBUyxLQUFLO0FBQ2IsU0FBTyxNQUFNLHlEQUF5RCxHQUFHO0FBQzFFOyIsInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswXX0=
