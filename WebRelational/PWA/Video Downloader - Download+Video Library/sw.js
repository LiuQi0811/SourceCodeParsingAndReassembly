const CACHE_NAME = 'downloaded-videos';

self.addEventListener('install', (event) => {
    console.log('✅ Service Worker 安装中...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker 已激活');
    event.waitUntil(clients.claim());
});

// 后台下载成功
self.addEventListener('backgroundfetchsuccess', (event) => {
    console.log('✅ 后台下载成功:', event.registration.id);
    
    event.waitUntil(
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);
                const records = await event.registration.matchAll();
                
                for (const record of records) {
                    try {
                        const response = await record.responseReady;
                        if (response && response.ok) {
                            await cache.put(record.request.url, response);
                            console.log('✅ 视频已缓存:', record.request.url);
                        }
                    } catch (err) {
                        console.error('缓存失败:', err);
                    }
                }
                
                await self.registration.showNotification('✅ 下载完成', {
                    body: `成功下载 ${records.length} 个视频`,
                    icon: '/icon.png',
                    tag: 'download-complete'
                });
                
            } catch (error) {
                console.error('处理下载失败:', error);
            }
        })()
    );
});

self.addEventListener('backgroundfetchfail', (event) => {
    console.error('❌ 后台下载失败:', event.registration.id);
    
    event.waitUntil(
        self.registration.showNotification('❌ 下载失败', {
            body: '部分视频下载失败，请检查网络',
            icon: '/icon.png',
            tag: 'download-failed'
        })
    );
});

self.addEventListener('backgroundfetchclick', (event) => {
    event.waitUntil(clients.openWindow('/'));
});

// 拦截视频请求，优先从缓存提供
self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('.mp4') || event.request.url.includes('video')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cachedResponse => {
                    return cachedResponse || fetch(event.request);
                });
            })
        );
    }
});