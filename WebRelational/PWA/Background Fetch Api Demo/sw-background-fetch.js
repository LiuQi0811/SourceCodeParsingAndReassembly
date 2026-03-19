// Background Fetch Service Worker
// 用于支持 Background Fetch API 演示

console.log('[SW] Background Fetch Service Worker 已加载');

// 安装事件
self.addEventListener('install', (event) => {
    console.log('[SW] Service Worker 安装中...');
    // 跳过等待，立即激活
    self.skipWaiting();
});

// 激活事件
self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker 已激活');
    // 立即控制所有客户端
    event.waitUntil(clients.claim());
});

// ============================================
// Background Fetch 事件处理
// ============================================

// 后台获取成功
self.addEventListener('backgroundfetchsuccess', (event) => {
    console.log('[SW] 后台获取成功:', event.registration.id);
    console.log('[SW] 下载详情:', {
        id: event.registration.id,
        downloaded: event.registration.downloaded,
        downloadTotal: event.registration.downloadTotal,
        result: event.registration.result
    });
    
    // 更新 UI 显示成功消息
    event.waitUntil(
        (async () => {
            try {
                // 获取下载的记录
                const records = await event.registration.matchAll();
                console.log('[SW] 下载记录数:', records.length);
                
                // 更新通知标题
                await event.updateUI({ 
                    title: `下载完成! (${records.length} 个文件)`
                });
                
                // 通知所有客户端
                const allClients = await clients.matchAll();
                allClients.forEach(client => {
                    client.postMessage({
                        type: 'BACKGROUND_FETCH_SUCCESS',
                        id: event.registration.id,
                        recordsCount: records.length
                    });
                });
            } catch (error) {
                console.error('[SW] 处理成功事件时出错:', error);
            }
        })()
    );
});

// 后台获取失败
self.addEventListener('backgroundfetchfail', (event) => {
    console.log('[SW] 后台获取失败:', event.registration.id);
    console.log('[SW] 失败原因:', event.registration.failureReason);
    
    event.waitUntil(
        (async () => {
            try {
                await event.updateUI({ 
                    title: '下载失败 - ' + getFailureReasonText(event.registration.failureReason)
                });
                
                // 通知所有客户端
                const allClients = await clients.matchAll();
                allClients.forEach(client => {
                    client.postMessage({
                        type: 'BACKGROUND_FETCH_FAIL',
                        id: event.registration.id,
                        failureReason: event.registration.failureReason
                    });
                });
            } catch (error) {
                console.error('[SW] 处理失败事件时出错:', error);
            }
        })()
    );
});

// 后台获取中止
self.addEventListener('backgroundfetchabort', (event) => {
    console.log('[SW] 后台获取已中止:', event.registration.id);
    
    // 通知所有客户端
    event.waitUntil(
        (async () => {
            const allClients = await clients.matchAll();
            allClients.forEach(client => {
                client.postMessage({
                    type: 'BACKGROUND_FETCH_ABORT',
                    id: event.registration.id
                });
            });
        })()
    );
});

// 用户点击通知
self.addEventListener('backgroundfetchclick', (event) => {
    console.log('[SW] 用户点击了后台获取通知:', event.registration.id);
    
    event.waitUntil(
        (async () => {
            // 获取所有客户端窗口
            const allClients = await clients.matchAll({ 
                type: 'window',
                includeUncontrolled: true 
            });
            
            // 如果有已打开的窗口，聚焦它
            if (allClients.length > 0) {
                // 使用第一个可用的窗口
                const client = allClients[0];
                if ('focus' in client) {
                    await client.focus();
                }
                // 发送消息
                client.postMessage({
                    type: 'BACKGROUND_FETCH_CLICK',
                    id: event.registration.id
                });
            } else {
                // 没有打开的窗口，打开新窗口
                await clients.openWindow('/');
            }
        })()
    );
});

// ============================================
// 辅助函数
// ============================================

function getFailureReasonText(reason) {
    const reasons = {
        '': '未知错误',
        'aborted': '用户取消',
        'bad-status': '服务器错误',
        'fetch-error': '网络错误',
        'quota-exceeded': '存储空间不足',
        'download-total-exceeded': '超出预计大小'
    };
    return reasons[reason] || reason;
}

// ============================================
// 消息处理
// ============================================

self.addEventListener('message', (event) => {
    console.log('[SW] 收到消息:', event.data);
    
    if (event.data && event.data.type) {
        switch (event.data.type) {
            case 'GET_BACKGROUND_FETCH_STATUS':
                // 返回当前状态
                event.ports[0].postMessage({
                    status: 'ready'
                });
                break;
        }
    }
});

// ============================================
// Fetch 事件处理（可选）
// ============================================

self.addEventListener('fetch', (event) => {
    // 可以在这里添加缓存策略
    event.respondWith(fetch(event.request));
});
