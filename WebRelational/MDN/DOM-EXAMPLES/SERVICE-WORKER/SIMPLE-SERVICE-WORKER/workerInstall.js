/**
 * addResourcesToCache 将指定资源列表批量添加到缓存中（用于 install 阶段预缓存）
 * @param {string[]} resources - 要缓存的资源 URL 数组
 * @author LiuQi
 */
const addResourcesToCache = async(resources) => {
    // 打开名为 "v1.0" 的缓存存储空间
    const cache = await caches.open("v1.0");
    // 使用 addAll() 一次性将所有资源请求并缓存（注意：所有请求必须成功，否则整个操作失败）
    await cache.addAll(resources);
};

/**
 * putInCache 将单个请求-响应对存入缓存
 * @param {Request} request - 原始请求对象
 * @param {Response} response - 对应的响应对象
 * @author LiuQi
 */
const putInCache = async(request, response) => {
    const cache = await caches.open("v1.0");
    // 将响应克隆一份后存入缓存（因为 Response 对象只能被消费一次）
    await cache.put(request, response.clone());
};

/**
 * initializeCache 初始化缓存策略：优先使用缓存 → 尝试导航预加载 → 回退到网络 → 最终使用离线兜底资源
 * @param {Object} options
 * @param {Request} options.request - 当前 fetch 事件的请求
 * @param {Promise<Response | null>} options.preloadResponsePromise - 导航预加载的响应 Promise
 * @param {string} options.fallbackUrl - 离线时使用的兜底资源路径
 * @returns {Promise<Response>}
 * @author LiuQi
 */
const initializeCache = async({ request, preloadResponsePromise, fallbackUrl }) => {
    // 1. 优先检查缓存中是否存在该请求的响应
    const responseFromCache = await caches.match(request);
    if (responseFromCache) {
        return responseFromCache; // 缓存命中，直接返回
    }

    // 2. 如果未命中缓存，尝试获取导航预加载的响应（仅适用于导航请求）
    const preloadResponse = await preloadResponsePromise;
    if (preloadResponse) {
        console.info("using preload response ", preloadResponse);
        // 将预加载的响应存入缓存（克隆一份，避免流被消费）
        putInCache(request, preloadResponse.clone());
        return preloadResponse; // 返回预加载响应
    }

    // 3. 如果预加载不可用，则尝试从网络获取
    try {
        const responseFromNetwork = await fetch(request.clone()); // 克隆请求以防被修改
        // 将网络响应存入缓存（实现“缓存优先 + 网络更新”策略）
        putInCache(request, responseFromNetwork.clone());
        return responseFromNetwork;
    } catch (error) {
        // 4. 网络请求失败，进入离线兜底逻辑
        const fallbackResponse = await caches.match(fallbackUrl);
        if (fallbackResponse) {
            return fallbackResponse; // 返回兜底图片或页面
        }
        // 若连兜底资源都没有，则返回自定义错误响应
        return new Response('Network error happened', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' },
        });
    }
};

/**
 * enableNavigationPreload 启用导航预加载功能（Navigation Preload）
 * 该功能允许在 Service Worker 激活期间并行发起导航请求，减少延迟
 * @author LiuQi
 */
const enableNavigationPreload = async() => {
    // 检查浏览器是否支持 navigationPreload
    if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
    }
};


// 激活阶段（activate）：启用导航预加载
self.addEventListener("activate", (event) => {
    // 使用 waitUntil() 告诉浏览器：激活过程尚未完成，需等待 enableNavigationPreload() 执行完毕
    event.waitUntil(enableNavigationPreload());
});

// 安装阶段（install）：预缓存关键静态资源
self.addEventListener("install", (event) => {
    // waitUntil() 确保安装过程等待 addResourcesToCache 完成
    // 若缓存失败（如某个资源 404），install 会失败，Service Worker 不会激活
    event.waitUntil(
        addResourcesToCache([
            "./",
            "./index.html",
            "./resource/style/index.css",
            "./main.js",
            "./imageList.js",
            "/WebRelational/MDN/DOM-EXAMPLES/IMAGE/star-wars-logo.jpg",
            // 以下为图库中的具体图片资源（后期通过动态缓存管理，避免硬编码）
            "/WebRelational/MDN/DOM-EXAMPLES/IMAGE/02d3a2993b9b53c48aa1016bc52c6cd36b0a80f7.jpg",
            "/WebRelational/MDN/DOM-EXAMPLES/IMAGE/0b9dd99e1199b78744e2779aa1dbab47b93402d1.jpg",
            "/WebRelational/MDN/DOM-EXAMPLES/IMAGE/0c27a55cc764d0a04c198d06de29399873fd2267.png",
            "/WebRelational/MDN/DOM-EXAMPLES/IMAGE/19156cc7f2818c1f2329c572c499f69ae2b80ec4.png",
            "/WebRelational/MDN/DOM-EXAMPLES/IMAGE/222ccf5bdd7e3351a8c8e44eb225ac0186f5409e.jpg",
            "/WebRelational/MDN/DOM-EXAMPLES/IMAGE/ce5f57e7a7ba0f531f2a6d970057e257106bed2c.jpg",
            "/WebRelational/MDN/DOM-EXAMPLES/IMAGE/eeb0f5e8899849d04d78fdc1e85adfe33d42ead1.jpg"
        ])
    );
});


// 拦截网络请求（fetch）：应用缓存策略
self.addEventListener("fetch", (event) => {
    // respondWith() 表示由 Service Worker 提供响应，不再走默认网络
    event.respondWith(
        initializeCache({
            request: event.request,
            // 注意：event.preloadResponse 是一个 Promise，代表导航预加载的响应
            preloadResponsePromise: event.preloadResponse,
            // 指定离线兜底图片（建议使用已缓存的资源）
            fallbackUrl: "/WebRelational/MDN/DOM-EXAMPLES/IMAGE/02d3a2993b9b53c48aa1016bc52c6cd36b0a80f7.jpg"
        })
    );
});