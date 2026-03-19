self.addEventListener('install', event => {
    console.log('Service Worker 安装中...');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Service Worker 已激活');
    event.waitUntil(clients.claim());
});

// 监听后台同步事件
self.addEventListener('sync', event => {
    console.log('🔥 后台同步事件触发，标签:', event.tag);
    
    if (event.tag === 'sync-messages') {
        event.waitUntil(
            processPendingMessages()
        );
    }
});

// 处理待发送消息的函数
async function processPendingMessages() {
    console.log('开始处理待发送的消息...');
    
    try {
        // 1. 从 IndexedDB 读取所有暂存消息
        const messages = await getMessagesFromDB();
        
        if (!messages || messages.length === 0) {
            console.log('没有待发送的消息');
            return;
        }
        
        console.log(`找到 ${messages.length} 条待发送的消息`);
        
        // 2. 尝试发送每一条消息
        for (const msg of messages) {
            try {
                // 模拟发送到服务器 - 使用更可靠的方式
                await simulateSendToServer(msg);
                
                console.log('✅ 消息发送成功:', msg.id, msg.content);
                
                // 3. 发送成功后，从 DB 中删除
                await deleteMessageFromDB(msg.id);
                
                // 4. 通知所有页面
                const clients = await self.clients.matchAll();
                clients.forEach(client => {
                    client.postMessage({ 
                        type: 'SYNC_SUCCESS', 
                        message: msg.content,
                        id: msg.id
                    });
                });
                
            } catch (error) {
                console.error('❌ 消息发送失败，将保留在队列中:', msg.id, error);
                // 如果一条失败，继续尝试下一条
                // 但最后会抛出错误让浏览器知道同步未完全成功
            }
        }
        
        // 检查是否还有未发送的消息
        const remainingMessages = await getMessagesFromDB();
        if (remainingMessages.length > 0) {
            throw new Error(`${remainingMessages.length} 条消息发送失败`);
        }
        
    } catch (error) {
        console.error('同步过程出错:', error);
        throw error; // 让浏览器知道同步失败，可能会重试
    }
}

// 模拟发送到服务器的函数（现在使用更可靠的模拟）
async function simulateSendToServer(message) {
    return new Promise((resolve, reject) => {
        console.log('📤 模拟发送消息到服务器:', message);
        
        // 模拟网络请求的延迟
        setTimeout(() => {
            // 90% 的成功率，模拟真实网络
            if (Math.random() < 0.9) {
                console.log('📨 服务器响应: 消息接收成功');
                resolve({ status: 'success' });
            } else {
                console.log('❌ 服务器响应: 发送失败');
                reject(new Error('模拟的随机失败'));
            }
        }, 1000);
    });
}

// --- IndexedDB 操作封装 ---
async function getMessagesFromDB() {
    return new Promise((resolve, reject) => {
        try {
            const request = indexedDB.open('MessageDB', 1);
            
            request.onerror = (event) => {
                console.error('打开数据库失败:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                
                // 检查对象存储是否存在
                if (!db.objectStoreNames.contains('messages')) {
                    db.close();
                    resolve([]);
                    return;
                }
                
                const tx = db.transaction('messages', 'readonly');
                const store = tx.objectStore('messages');
                const getAll = store.getAll();
                
                getAll.onsuccess = () => {
                    db.close();
                    resolve(getAll.result || []);
                };
                
                getAll.onerror = (e) => {
                    db.close();
                    reject(e.target.error);
                };
            };
            
            request.onupgradeneeded = (event) => {
                // 如果数据库升级，创建对象存储
                const db = event.target.result;
                if (!db.objectStoreNames.contains('messages')) {
                    db.createObjectStore('messages', { autoIncrement: true, keyPath: 'id' });
                }
            };
        } catch (error) {
            console.error('IndexedDB 操作出错:', error);
            reject(error);
        }
    });
}

async function deleteMessageFromDB(id) {
    return new Promise((resolve, reject) => {
        try {
            const request = indexedDB.open('MessageDB', 1);
            
            request.onsuccess = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('messages')) {
                    db.close();
                    resolve();
                    return;
                }
                
                const tx = db.transaction('messages', 'readwrite');
                const store = tx.objectStore('messages');
                const deleteReq = store.delete(id);
                
                deleteReq.onsuccess = () => {
                    db.close();
                    console.log(`已从数据库删除消息 ${id}`);
                    resolve();
                };
                
                deleteReq.onerror = (e) => {
                    db.close();
                    reject(e.target.error);
                };
            };
            
            request.onerror = (e) => reject(e.target.error);
        } catch (error) {
            console.error('删除消息失败:', error);
            reject(error);
        }
    });
}