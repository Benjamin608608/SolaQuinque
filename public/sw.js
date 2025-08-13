// Service Worker for background processing
// 注意：移動端瀏覽器對背景處理有嚴格限制，這只能部分改善體驗

const CACHE_NAME = 'theology-v1';
const API_CACHE_NAME = 'theology-api-v1';

// 安裝Service Worker
self.addEventListener('install', event => {
    console.log('📦 Service Worker 安裝中...');
    self.skipWaiting();
});

// 激活Service Worker
self.addEventListener('activate', event => {
    console.log('🚀 Service Worker 已激活');
    event.waitUntil(self.clients.claim());
});

// 背景同步（有限支持）
self.addEventListener('sync', event => {
    console.log('🔄 背景同步事件:', event.tag);
    
    if (event.tag === 'search-recovery') {
        event.waitUntil(handleSearchRecovery());
    }
});

// 嘗試處理搜索恢復
async function handleSearchRecovery() {
    try {
        // 檢查是否有未完成的請求
        const pendingRequests = await getStoredRequests();
        
        for (const request of pendingRequests) {
            // 嘗試恢復請求（但實際上移動端限制很大）
            console.log('🔄 嘗試恢復請求:', request);
            
            // 由於API限制，實際上很難在背景完成
            // 主要作用是保存狀態，等待前台恢復
        }
    } catch (error) {
        console.error('背景恢復失敗:', error);
    }
}

// 獲取存儲的請求
async function getStoredRequests() {
    try {
        const cache = await caches.open(API_CACHE_NAME);
        const requests = await cache.match('/pending-requests');
        if (requests) {
            return await requests.json();
        }
    } catch (error) {
        console.error('獲取存儲請求失敗:', error);
    }
    return [];
}

// 消息處理
self.addEventListener('message', event => {
    const { type, data } = event.data;
    
    switch (type) {
        case 'SAVE_PENDING_REQUEST':
            savePendingRequest(data);
            break;
        case 'CLEAR_PENDING_REQUEST':
            clearPendingRequest(data);
            break;
        case 'CHECK_BACKGROUND_STATUS':
            event.ports[0].postMessage({
                status: 'limited',
                message: '移動端背景處理受限，建議保持前台運行'
            });
            break;
    }
});

// 保存待處理請求
async function savePendingRequest(requestData) {
    try {
        const cache = await caches.open(API_CACHE_NAME);
        const response = new Response(JSON.stringify([requestData]));
        await cache.put('/pending-requests', response);
        console.log('💾 已保存待處理請求');
    } catch (error) {
        console.error('保存請求失敗:', error);
    }
}

// 清除待處理請求
async function clearPendingRequest(requestId) {
    try {
        const cache = await caches.open(API_CACHE_NAME);
        await cache.delete('/pending-requests');
        console.log('🗑️ 已清除待處理請求');
    } catch (error) {
        console.error('清除請求失敗:', error);
    }
}

// 網絡攔截（有限改善）
self.addEventListener('fetch', event => {
    // 對於API請求，嘗試提供更好的錯誤處理
    if (event.request.url.includes('/api/')) {
        event.respondWith(handleApiRequest(event.request));
    }
});

async function handleApiRequest(request) {
    try {
        // 嘗試正常請求
        const response = await fetch(request);
        return response;
    } catch (error) {
        console.error('API請求失敗:', error);
        
        // 返回友好的錯誤響應
        return new Response(JSON.stringify({
            error: '網絡連接中斷，請檢查連接後重試',
            background: true
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}