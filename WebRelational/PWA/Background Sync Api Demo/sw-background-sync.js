// Background Synchronization Service Worker
// For Background Sync API Demo

console.log('[SW] Background Sync Service Worker loaded');

// ============================================
// Install Event
// ============================================
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// ============================================
// Activate Event
// ============================================
self.addEventListener('activate', (event) => {
    console.log('[SW] Service Worker activated');
    // Claim all clients immediately
    event.waitUntil(clients.claim());
});

// ============================================
// Sync Event Handler (Background Sync)
// ============================================
self.addEventListener('sync', (event) => {
    console.log('[SW] Sync event received:', {
        tag: event.tag,
        lastChance: event.lastChance,
        type: event.type
    });
    
    // Handle different sync tags
    event.waitUntil(handleSyncEvent(event));
});

async function handleSyncEvent(event) {
    const { tag, lastChance } = event;
    
    try {
        switch (tag) {
            case 'demo-sync-1':
                await performDemoSync();
                break;
            case 'sync-messages':
                await syncMessages();
                break;
            case 'sync-data':
                await syncData();
                break;
            default:
                console.log('[SW] Unknown sync tag:', tag);
                // Handle generic sync
                await performGenericSync(tag);
        }
        
        // Notify all clients of successful sync
        await notifyClients({
            type: 'SYNC_SUCCESS',
            tag: tag,
            lastChance: lastChance
        });
        
        console.log('[SW] Sync completed successfully:', tag);
        
    } catch (error) {
        console.error('[SW] Sync failed:', tag, error);
        
        // Notify clients of failure
        await notifyClients({
            type: 'SYNC_FAILED',
            tag: tag,
            error: error.message,
            lastChance: lastChance
        });
        
        // If this is the last chance, handle accordingly
        if (lastChance) {
            console.error('[SW] Final sync attempt failed for:', tag);
            // Could store failure for later retry or user notification
        }
        
        // Re-throw to signal failure to the browser
        throw error;
    }
}

// ============================================
// Periodic Sync Event Handler
// ============================================
self.addEventListener('periodicsync', (event) => {
    console.log('[SW] Periodic sync event received:', {
        tag: event.tag,
        type: event.type
    });
    
    event.waitUntil(handlePeriodicSyncEvent(event));
});

async function handlePeriodicSyncEvent(event) {
    const { tag } = event;
    
    try {
        switch (tag) {
            case 'daily-sync':
                await performDailySync();
                break;
            case 'hourly-sync':
                await performHourlySync();
                break;
            default:
                console.log('[SW] Unknown periodic sync tag:', tag);
                await performGenericPeriodicSync(tag);
        }
        
        await notifyClients({
            type: 'PERIODIC_SYNC_SUCCESS',
            tag: tag
        });
        
        console.log('[SW] Periodic sync completed:', tag);
        
    } catch (error) {
        console.error('[SW] Periodic sync failed:', tag, error);
        
        await notifyClients({
            type: 'PERIODIC_SYNC_FAILED',
            tag: tag,
            error: error.message
        });
        
        throw error;
    }
}

// ============================================
// Sync Implementation Functions
// ============================================

async function performDemoSync() {
    console.log('[SW] Performing demo sync...');
    
    // Simulate network request
    await simulateNetworkRequest(1000);
    
    // Store sync timestamp in IndexedDB or Cache
    const timestamp = new Date().toISOString();
    console.log('[SW] Demo sync completed at:', timestamp);
    
    return { success: true, timestamp };
}

async function syncMessages() {
    console.log('[SW] Syncing messages...');
    
    // Get pending messages from IndexedDB
    // const pendingMessages = await getPendingMessages();
    
    // Send each message
    // for (const message of pendingMessages) {
    //     await sendMessage(message);
    // }
    
    await simulateNetworkRequest(500);
    
    console.log('[SW] Messages synced successfully');
    return { success: true };
}

async function syncData() {
    console.log('[SW] Syncing data...');
    
    // Fetch latest data from server
    // const response = await fetch('/api/sync');
    // const data = await response.json();
    
    // Store in IndexedDB
    // await storeData(data);
    
    await simulateNetworkRequest(800);
    
    console.log('[SW] Data synced successfully');
    return { success: true };
}

async function performGenericSync(tag) {
    console.log('[SW] Performing generic sync for:', tag);
    await simulateNetworkRequest(500);
    return { success: true, tag };
}

async function performDailySync() {
    console.log('[SW] Performing daily sync...');
    
    // Check for updates, refresh cache, etc.
    await simulateNetworkRequest(2000);
    
    console.log('[SW] Daily sync completed');
    return { success: true };
}

async function performHourlySync() {
    console.log('[SW] Performing hourly sync...');
    
    await simulateNetworkRequest(1000);
    
    console.log('[SW] Hourly sync completed');
    return { success: true };
}

async function performGenericPeriodicSync(tag) {
    console.log('[SW] Performing generic periodic sync for:', tag);
    await simulateNetworkRequest(500);
    return { success: true, tag };
}

// ============================================
// Helper Functions
// ============================================

function simulateNetworkRequest(duration) {
    return new Promise(resolve => setTimeout(resolve, duration));
}

async function notifyClients(message) {
    const allClients = await clients.matchAll({ includeUncontrolled: true });
    
    allClients.forEach(client => {
        client.postMessage(message);
    });
}

// ============================================
// Message Handler
// ============================================
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);
    
    if (event.data && event.data.type) {
        switch (event.data.type) {
            case 'GET_STATUS':
                event.ports[0].postMessage({
                    status: 'ready',
                    timestamp: new Date().toISOString()
                });
                break;
                
            case 'TRIGGER_SYNC':
                // Manually trigger a sync (for testing)
                if (event.data.tag) {
                    self.registration.sync.register(event.data.tag)
                        .then(() => console.log('[SW] Manual sync registered:', event.data.tag))
                        .catch(err => console.error('[SW] Manual sync failed:', err));
                }
                break;
        }
    }
});

// ============================================
// Fetch Handler (Optional)
// ============================================
self.addEventListener('fetch', (event) => {
    // Default: just fetch from network
    event.respondWith(fetch(event.request));
});

// ============================================
// Push Handler (Optional - for notifications)
// ============================================
self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event);
    
    const options = {
        body: event.data ? event.data.text() : 'Background sync notification',
        icon: '/icon.png',
        badge: '/badge.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now()
        }
    };
    
    event.waitUntil(
        self.registration.showNotification('Background Sync', options)
    );
});

// ============================================
// Notification Click Handler
// ============================================
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event);
    
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});
