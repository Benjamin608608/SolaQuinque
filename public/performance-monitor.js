// 性能監控和優化腳本
(function() {
    'use strict';
    
    // 性能計時器
    const performanceTracker = {
        timers: new Map(),
        
        start(name) {
            this.timers.set(name, performance.now());
        },
        
        end(name) {
            const startTime = this.timers.get(name);
            if (startTime) {
                const duration = performance.now() - startTime;
                console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);
                this.timers.delete(name);
                return duration;
            }
        }
    };
    
    // 圖片懶加載優化
    function setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        observer.unobserve(img);
                    }
                });
            });
            
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }
    
    // 防抖函數優化
    function debounce(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    }
    
    // 節流函數優化
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // 網路狀態監控
    function setupNetworkMonitoring() {
        if ('navigator' in window && 'onLine' in navigator) {
            function updateNetworkStatus() {
                const isOnline = navigator.onLine;
                document.body.classList.toggle('offline', !isOnline);
                
                if (!isOnline) {
                    showOfflineMessage();
                } else {
                    hideOfflineMessage();
                }
            }
            
            window.addEventListener('online', updateNetworkStatus);
            window.addEventListener('offline', updateNetworkStatus);
            updateNetworkStatus();
        }
    }
    
    function showOfflineMessage() {
        if (!document.getElementById('offline-message')) {
            const message = document.createElement('div');
            message.id = 'offline-message';
            message.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50';
            message.textContent = '網路連接已中斷';
            document.body.appendChild(message);
        }
    }
    
    function hideOfflineMessage() {
        const message = document.getElementById('offline-message');
        if (message) {
            message.remove();
        }
    }
    
    // 記憶體使用監控
    function monitorMemoryUsage() {
        if ('memory' in performance) {
            const memoryInfo = performance.memory;
            const usedJSHeapSize = Math.round(memoryInfo.usedJSHeapSize / 1048576);
            const totalJSHeapSize = Math.round(memoryInfo.totalJSHeapSize / 1048576);
            
            console.log(`Memory Usage: ${usedJSHeapSize}MB / ${totalJSHeapSize}MB`);
            
            // 如果記憶體使用過高，發出警告
            if (usedJSHeapSize > 100) {
                console.warn('High memory usage detected. Consider optimizing.');
            }
        }
    }
    
    // 初始化性能監控
    document.addEventListener('DOMContentLoaded', function() {
        performanceTracker.start('page-load');
        
        setupLazyLoading();
        setupNetworkMonitoring();
        
        // 每30秒監控一次記憶體使用
        setInterval(monitorMemoryUsage, 30000);
        
        // 頁面載入完成後記錄時間
        window.addEventListener('load', function() {
            performanceTracker.end('page-load');
        });
    });
    
    // 暴露工具到全局作用域
    window.performanceUtils = {
        tracker: performanceTracker,
        debounce,
        throttle
    };
    
})();