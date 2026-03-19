// Service Worker版本
const SW_VERSION = '1.0.0';
const CACHE_NAME = `video-cache-${SW_VERSION}`;

console.log(`⚙️ Service Worker v${SW_VERSION} 启动中...`);

// 安装事件
self.addEventListener("install", (event) => {
    console.log("✅ Service Worker 安装中...");
    self.skipWaiting(); // 立即激活
    
    // 预缓存一些资源
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('缓存已创建');
            return cache.addAll([
                '/',
                '/index.html'
            ]).catch(err => {
                console.log('预缓存失败（非关键错误）:', err);
            });
        })
    );
});

// 激活事件
self.addEventListener("activate", (event) => {
    console.log("✅ Service Worker 已激活");
    
    // 清理旧缓存
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('删除旧缓存:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // 立即控制所有客户端
            return clients.claim();
        })
    );
});

// 后台下载成功事件
self.addEventListener("backgroundfetchsuccess", (event) => {
    console.log('✅ 后台下载成功:', event.registration.id);
    console.log('下载详情:', event.registration);
    
    event.waitUntil(
        (async () => {
            try {
                // 获取所有下载记录
                const records = await event.registration.matchAll();
                console.log(`成功下载 ${records.length} 个文件`);
                
                // 缓存下载的文件
                const cache = await caches.open('downloaded-videos');
                
                for (const record of records) {
                    try {
                        const response = await record.responseReady;
                        if (response && response.ok) {
                            await cache.put(record.request, response);
                            console.log('已缓存:', record.request.url);
                        }
                    } catch (err) {
                        console.log('缓存单个文件失败:', err);
                    }
                }
                
                // 显示通知
                await self.registration.showNotification('✅ 后台下载完成', {
                    body: `成功下载 ${records.length} 个视频文件`,
                    icon: '/icon.png',
                    badge: '/badge.png',
                    tag: 'download-complete',
                    vibrate: [200, 100, 200],
                    data: {
                        url: '/',
                        downloadId: event.registration.id
                    }
                });
                
            } catch (error) {
                console.error('处理下载成功事件失败:', error);
            }
        })()
    );
});

// 后台下载失败事件
self.addEventListener("backgroundfetchfail", (event) => {
    console.error('❌ 后台下载失败:', event.registration.id);
    
    event.waitUntil(
        (async () => {
            try {
                const records = await event.registration.matchAll();
                const failedRecords = records.filter(record => !record.responseReady);
                
                // 显示失败通知
                await self.registration.showNotification('❌ 后台下载失败', {
                    body: `有 ${failedRecords.length} 个文件下载失败，请检查网络`,
                    icon: '/icon.png',
                    badge: '/badge.png',
                    tag: 'download-failed',
                    vibrate: [200, 100, 200],
                    data: {
                        url: '/'
                    }
                });
                
            } catch (error) {
                console.error('处理下载失败事件出错:', error);
            }
        })()
    );
});

// 后台下载中止事件
self.addEventListener("backgroundfetchabort", (event) => {
    console.log('⛔ 后台下载被中止:', event.registration.id);
});

// 用户点击后台下载通知事件
self.addEventListener("backgroundfetchclick", (event) => {
    console.log('📱 用户点击了后台下载通知:', event.registration.id);
    
    event.waitUntil(
        (async () => {
            // 打开或聚焦到应用页面
            const clients = await self.clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            });
            
            if (clients.length > 0) {
                // 如果有打开的窗口，聚焦到第一个
                return clients[0].focus();
            } else {
                // 否则打开新窗口
                return self.clients.openWindow('/');
            }
        })()
    );
});

// 网络请求拦截（用于缓存策略）
self.addEventListener("fetch", (event) => {
    // 只处理GET请求
    if (event.request.method !== 'GET') return;
    
    // 视频文件请求策略：优先网络，失败则使用缓存
    if (event.request.url.includes('.mp4') || event.request.url.includes('video')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // 缓存视频文件
                    const responseClone = response.clone();
                    caches.open('video-stream').then(cache => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // 网络失败，尝试从缓存获取
                    return caches.match(event.request);
                })
        );
    } else {
        // 其他资源：优先缓存，其次网络
        event.respondWith(
            caches.match(event.request)
                .then(response => response || fetch(event.request))
        );
    }
});

// 监听消息
self.addEventListener("message", (event) => {
    console.log('收到消息:', event.data);
    
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});

// 定期检查更新
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'update-cache') {
        event.waitUntil(updateCache());
    }
});

// 更新缓存函数
async function updateCache() {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    for (const request of requests) {
        try {
            const response = await fetch(request);
            if (response.ok) {
                await cache.put(request, response);
            }
        } catch (err) {
            console.log('更新缓存失败:', err);
        }
    }
}

console.log(`✅ Service Worker v${SW_VERSION} 已就绪`);