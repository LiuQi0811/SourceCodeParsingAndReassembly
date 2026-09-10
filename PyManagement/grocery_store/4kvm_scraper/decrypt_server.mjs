/**
 * 完美WASM解密服务
 * 使用原始WASM二进制文件，100%还原浏览器解密逻辑
 * 通过HTTP API提供解密服务，供Python爬虫调用
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 29527;

// ==================== 完美复刻WASM模块加载 ====================
let buildPlayUrl = null;

async function initWasm() {
    const wasmBuffer = fs.readFileSync(path.join(__dirname, 'nbmovie_wasm_bg.wasm'));
    
    const heap = new Array(1024).fill(undefined);
    heap.push(undefined, null, true, false);
    let heap_next = heap.length;
    
    function addHeapObject(obj) {
        if (heap_next === heap.length) heap.push(heap.length + 1);
        const idx = heap_next;
        heap_next = heap[idx];
        heap[idx] = obj;
        return idx;
    }
    
    function getObject(idx) { return heap[idx]; }
    
    function dropObject(idx) {
        if (idx < 1028) return;
        heap[idx] = heap_next;
        heap_next = idx;
    }
    
    function takeObject(idx) {
        const ret = getObject(idx);
        dropObject(idx);
        return ret;
    }
    
    const cachedTextEncoder = new TextEncoder();
    const cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    
    let WASM_VECTOR_LEN = 0;
    let wasm;
    let cachedUint8ArrayMemory0 = null;
    let cachedDataViewMemory0 = null;
    
    function getUint8ArrayMemory0() {
        if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0 || cachedUint8ArrayMemory0.buffer !== wasm.memory.buffer) {
            cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
        }
        return cachedUint8ArrayMemory0;
    }
    
    function getDataViewMemory0() {
        if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer !== wasm.memory.buffer) {
            cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
        }
        return cachedDataViewMemory0;
    }
    
    function passStringToWasm0(arg, malloc, realloc) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }
    
    function getStringFromWasm0(ptr, len) {
        ptr = ptr >>> 0;
        return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
    }
    
    const imports = {
        "./nbmovie_wasm_bg.js": {
            __wbg___wbindgen_is_undefined_52709e72fb9f179c: function(arg0) {
                return getObject(arg0) === undefined;
            },
            __wbg___wbindgen_throw_6ddd609b62940d55: function(arg0, arg1) {
                throw new Error(getStringFromWasm0(arg0, arg1));
            },
            __wbg_content_4373268a6f34e443: function(arg0, arg1) {
                const ret = getObject(arg1).content;
                const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
                const len1 = WASM_VECTOR_LEN;
                getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
                getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
            },
            __wbg_document_c0320cd4183c6d9b: function(arg0) {
                const ret = getObject(arg0).document;
                return (ret === undefined || ret === null) ? 0 : addHeapObject(ret);
            },
            __wbg_getElementById_d1f25d287b19a833: function(arg0, arg1, arg2) {
                const ret = getObject(arg0).getElementById(getStringFromWasm0(arg1, arg2));
                return (ret === undefined || ret === null) ? 0 : addHeapObject(ret);
            },
            __wbg_instanceof_HtmlMetaElement_07f78901e9785572: function(arg0) {
                try { return getObject(arg0) instanceof HTMLMetaElement; } catch (_) { return false; }
            },
            __wbg_instanceof_Window_23e677d2c6843922: function(arg0) {
                try { return getObject(arg0) instanceof Window; } catch (_) { return false; }
            },
            __wbg_now_16f0c993d5dd6c27: function() { return Date.now(); },
            __wbg_static_accessor_GLOBAL_8adb955bd33fac2f: function() {
                const ret = typeof global === 'undefined' ? null : global;
                return (ret === undefined || ret === null) ? 0 : addHeapObject(ret);
            },
            __wbg_static_accessor_GLOBAL_THIS_ad356e0db91c7913: function() {
                const ret = typeof globalThis === 'undefined' ? null : globalThis;
                return (ret === undefined || ret === null) ? 0 : addHeapObject(ret);
            },
            __wbg_static_accessor_SELF_f207c857566db248: function() {
                const ret = typeof self === 'undefined' ? null : self;
                return (ret === undefined || ret === null) ? 0 : addHeapObject(ret);
            },
            __wbg_static_accessor_WINDOW_bb9f1ba69d61b386: function() {
                const ret = typeof window === 'undefined' ? null : window;
                return (ret === undefined || ret === null) ? 0 : addHeapObject(ret);
            },
            __wbindgen_object_clone_ref: function(arg0) { return addHeapObject(getObject(arg0)); },
            __wbindgen_object_drop_ref: function(arg0) { takeObject(arg0); },
        }
    };
    
    const { instance } = await WebAssembly.instantiate(wasmBuffer, imports);
    wasm = instance.exports;
    
    buildPlayUrl = function(dataid, secret_key, quality, play_key) {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(String(dataid), wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(String(secret_key), wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(String(quality), wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(String(play_key), wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len3 = WASM_VECTOR_LEN;
        wasm.build_play_url(retptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        const result = getStringFromWasm0(r0, r1);
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(r0, r1, 1);
        return result;
    };
    
    console.log('WASM模块加载完成, build_play_url函数就绪');
}

// ==================== HTTP服务 ====================
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (url.pathname === '/build_url' && req.method === 'GET') {
        const dataid = url.searchParams.get('dataid');
        const secret_key = url.searchParams.get('key');
        const quality = url.searchParams.get('q') || '1080';
        const play_key = url.searchParams.get('play_key') || 'X1VVVkZQXQUICg4FCgc7IUlZVU8=';
        
        if (!dataid || !secret_key) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '缺少参数 dataid/key' }));
            return;
        }
        
        try {
            const apiUrl = buildPlayUrl(dataid, secret_key, quality, play_key);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ url: apiUrl }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }
    
    if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', wasm_ready: buildPlayUrl !== null }));
        return;
    }
    
    res.writeHead(404);
    res.end('Not Found');
});

// 启动
await initWasm();
server.listen(PORT, () => {
    console.log(`解密服务运行在 http://localhost:${PORT}`);
    console.log('API: /build_url?dataid=xxx&key=xxx&q=1080');
    console.log('健康检查: /health');
});
