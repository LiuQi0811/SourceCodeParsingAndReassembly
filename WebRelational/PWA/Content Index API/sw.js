// sw.js - Service Worker 文件
const CACHE_NAME = 'offline-content-v2';

self.addEventListener('install', (event) => {
  console.log('Service Worker 已安装');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker 已激活');
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// 缓存策略
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  const cacheableExtensions = ['.html', '.css', '.js', '.jpg', '.png', '.svg', '.json'];
  const shouldCache = cacheableExtensions.some(ext => 
    url.pathname.toLowerCase().endsWith(ext)
                                              ) || url.pathname.includes('/offline/') || url.pathname.includes('/content/');

  if (!shouldCache) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request)
          .then(networkResponse => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
              console.log('已缓存:', event.request.url);
            }
            return networkResponse;
          })
          .catch(error => {
            console.log('网络请求失败:', error);
            return null;
          });

        return cachedResponse || fetchPromise;
      });
    })
  );
});

self.addEventListener('contentdelete', (event) => {
  console.log('内容被删除，ID:', event.id);

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.keys().then(requests => {
        const deletePromises = requests.map(request => {
          if (request.url.includes(event.id)) {
            return cache.delete(request);
          }
        });
        return Promise.all(deletePromises);
      });
    }).then(() => {
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'CONTENT_DELETED',
            id: event.id
          });
        });
      });
      console.log(`已清理 ID 为 ${event.id} 的缓存内容`);
    })
  );
});

// 消息处理
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
    
    switch(type) {
        case 'CACHE_URL':
            caches.open(CACHE_NAME).then(cache => {
                fetch(data.url)
                    .then(response => {
                        if (response.ok) {
                            cache.put(data.url, response);
                            event.ports[0].postMessage({
                                type: 'CACHE_SUCCESS',
                                url: data.url
                            });
                        } else {
                            throw new Error('请求失败');
                        }
                    })
                    .catch(error => {
                        event.ports[0].postMessage({
                            type: 'CACHE_ERROR',
                            url: data.url,
                            error: error.message
                        });
                    });
            });
            break;
            
        case 'GET_CACHE_INFO':
            caches.open(CACHE_NAME).then(cache => {
                cache.keys().then(requests => {
                    Promise.all(requests.map(req => 
                        cache.match(req).then(res => ({
                            url: req.url,
                            size: res ? res.headers.get('content-length') || 0 : 0,
                            type: res ? res.headers.get('content-type') || 'unknown' : 'unknown'
                        }))
                    )).then(details => {
                        event.ports[0].postMessage({
                            type: 'CACHE_INFO',
                            count: requests.length,
                            totalSize: details.reduce((sum, d) => sum + parseInt(d.size || 0), 0),
                            details: details
                        });
                    });
                });
            });
            break;
            
        case 'CLEAR_CACHE':
            caches.delete(CACHE_NAME).then(() => {
                event.ports[0].postMessage({
                    type: 'CACHE_CLEARED',
                    success: true
                });
            });
            break;
            
        case 'CHECK_CACHE':
            caches.open(CACHE_NAME).then(cache => {
                cache.match(data.url).then(response => {
                    event.ports[0].postMessage({
                        type: 'CACHE_CHECK',
                        url: data.url,
                        isCached: !!response
                    });
                });
            });
            break;
    }
});