#!/usr/bin/env node
// 10_env_patch.js —— 第 10 章「补环境」实战
//
// 目标：不改算法一行代码，把靶场前端 JS「原样搬进 Node」跑出合法签名。
// 用法：
//   1) 先启动本地靶场：  python 08_flask_lab.py
//   2) 再运行本脚本：    node 10_env_patch.js
//
// 无需任何 npm 依赖，Node.js 14+ 即可运行。

"use strict";
const http = require("http");

// —— 模拟「原样搬下来」的目标站 JS：强依赖浏览器环境，直接跑必报错 ——
// 签名算法与第 9 章靶场同源（djb2 变体），盐值 SPIDER_LAB 藏在 base64 里，
// 只有在浏览器（或补好环境的 Node）里才能解出来。
const TARGET_SITE_JS = `
var _envCheck = (function () {
  if (typeof window === "undefined") { throw new Error("env check: window missing"); }
  if (!window.document || !window.document.title) { throw new Error("env check: document missing"); }
  if (!window.navigator || window.navigator.userAgent.length < 10) { throw new Error("env check: navigator suspicious"); }
  return true;
})();

function _getToken(kw, ts) {
  var salt = window.atob("U1BJREVSX0xBQg==");   // base64 → SPIDER_LAB
  var s = kw + "|" + ts + "|" + salt;
  var h = 5381;
  for (var i = 0; i < s.length; i++) {
    h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}
`;

// —— 补环境的「眼睛」：Proxy 包装假环境，记录目标代码访问了哪些属性 ——
function logged(obj, label) {
  return new Proxy(obj, {
    get(target, prop) {
      if (typeof prop === "string") {
        console.log("  [环境监控] " + label + "." + prop + " 被访问");
      }
      const value = Reflect.get(target, prop);
      if (value && typeof value === "object") {
        return logged(value, label + "." + String(prop));   // 嵌套对象继续监控
      }
      return value;
    },
  });
}

function main() {
  console.log("—— 第 1 步：什么都不补，直接跑 ——");
  try {
    new Function(TARGET_SITE_JS + "\nreturn _getToken;")();
  } catch (e) {
    console.log("  失败 → " + e.message);
  }

  console.log("\n—— 第 2 步：补环境（伪造 window，Proxy 全程监控）——");
  globalThis.window = logged(
    {
      document: { title: "Spider Lab 商城（练习用）" },
      navigator: {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0",
      },
      location: { href: "http://127.0.0.1:5000/" },
      atob: (b64) => Buffer.from(b64, "base64").toString("binary"),
    },
    "window"
  );

  const getToken = new Function(TARGET_SITE_JS + "\nreturn _getToken;")();
  const kw = "cpu";
  const ts = String(Math.floor(Date.now() / 1000));
  const sign = getToken(kw, ts);
  console.log("\n  签名生成成功 → sign = " + sign);

  console.log("\n—— 第 3 步：拿签名请求本地靶场验证 ——");
  const path =
    "/api/data?kw=" + encodeURIComponent(kw) + "&ts=" + ts + "&sign=" + sign;
  const req = http.get({ host: "127.0.0.1", port: 5000, path: path }, (res) => {
    let body = "";
    res.on("data", (chunk) => { body += chunk; });
    res.on("end", () => {
      let pretty = body;
      try { pretty = JSON.stringify(JSON.parse(body)); } catch (e) { /* 非 JSON 就原样输出 */ }
      console.log("  靶场响应 → HTTP " + res.statusCode + " " + pretty);
      if (res.statusCode === 200) {
        console.log("\n补环境成功：没还原一行算法，签名照样合法！");
      }
    });
  });
  req.on("error", () => {
    console.log("  靶场未启动？先运行 python 08_flask_lab.py 再试。");
    console.log("  本次签名 120 秒内有效，也可手动验证：");
    console.log('  curl "http://127.0.0.1:5000' + path + '"');
  });
}

main();
