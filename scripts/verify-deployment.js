#!/usr/bin/env node

/**
 * 部署驗證腳本
 * 檢查部署後的應用程式狀態和功能
 */

const https = require('https');
const http = require('http');

// 配置
const CONFIG = {
    // 從環境變數或命令行參數獲取URL
    baseUrl: process.env.APP_URL || process.argv[2] || 'https://theologian2-production.up.railway.app',
    timeout: 10000, // 10秒超時
    endpoints: [
        '/api/health',
        '/api/info', 
        '/api/catalog',
        '/'
    ]
};

// 顏色輸出
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// HTTP請求函數
function makeRequest(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https:') ? https : http;
        const startTime = Date.now();
        
        const req = protocol.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const responseTime = Date.now() - startTime;
                resolve({
                    statusCode: res.statusCode,
                    responseTime,
                    data: data,
                    headers: res.headers
                });
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(CONFIG.timeout, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

// 檢查單個端點
async function checkEndpoint(endpoint) {
    const url = `${CONFIG.baseUrl}${endpoint}`;
    log(`\n🔍 檢查端點: ${endpoint}`, 'blue');
    
    try {
        const result = await makeRequest(url);
        
        if (result.statusCode === 200) {
            log(`✅ 狀態: ${result.statusCode} OK (${result.responseTime}ms)`, 'green');
            
            // 解析特定端點的響應
            if (endpoint === '/api/health') {
                try {
                    const healthData = JSON.parse(result.data);
                    log(`   📊 系統狀態: ${healthData.status || 'unknown'}`, 'green');
                    log(`   🕐 運行時間: ${healthData.uptime || 'unknown'}`, 'blue');
                } catch (e) {
                    log(`   ⚠️  無法解析健康檢查數據`, 'yellow');
                }
            } else if (endpoint === '/api/info') {
                try {
                    const infoData = JSON.parse(result.data);
                    log(`   ℹ️  版本: ${infoData.version || 'unknown'}`, 'blue');
                    log(`   🌍 環境: ${infoData.environment || 'unknown'}`, 'blue');
                } catch (e) {
                    log(`   ⚠️  無法解析系統資訊`, 'yellow');
                }
            } else if (endpoint === '/') {
                const contentLength = result.headers['content-length'] || result.data.length;
                log(`   📄 頁面大小: ${contentLength} bytes`, 'blue');
                
                // 檢查關鍵HTML元素
                if (result.data.includes('神學知識庫')) {
                    log(`   ✅ 頁面標題正確`, 'green');
                } else {
                    log(`   ⚠️  頁面標題可能有問題`, 'yellow');
                }
                
                if (result.data.includes('performance-monitor.js')) {
                    log(`   ✅ 性能監控腳本已載入`, 'green');
                } else {
                    log(`   ⚠️  性能監控腳本未找到`, 'yellow');
                }
                
                if (result.data.includes('theme.js')) {
                    log(`   ✅ 主題腳本已載入`, 'green');
                } else {
                    log(`   ⚠️  主題腳本未找到`, 'yellow');
                }
            }
            
            return { success: true, responseTime: result.responseTime };
            
        } else {
            log(`❌ 狀態: ${result.statusCode} (${result.responseTime}ms)`, 'red');
            return { success: false, statusCode: result.statusCode, responseTime: result.responseTime };
        }
        
    } catch (error) {
        log(`❌ 錯誤: ${error.message}`, 'red');
        return { success: false, error: error.message };
    }
}

// 主要驗證函數
async function verifyDeployment() {
    log(`${colors.bold}🚀 開始驗證部署 - ${CONFIG.baseUrl}${colors.reset}`);
    log(`⏰ 時間: ${new Date().toLocaleString()}`);
    
    const results = [];
    let totalTime = 0;
    
    for (const endpoint of CONFIG.endpoints) {
        const result = await checkEndpoint(endpoint);
        results.push({ endpoint, ...result });
        
        if (result.responseTime) {
            totalTime += result.responseTime;
        }
        
        // 在檢查之間暫停
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 摘要報告
    log(`\n${colors.bold}📋 部署驗證摘要${colors.reset}`);
    log(`==========================================`);
    
    const successfulChecks = results.filter(r => r.success).length;
    const totalChecks = results.length;
    
    if (successfulChecks === totalChecks) {
        log(`✅ 所有檢查通過! (${successfulChecks}/${totalChecks})`, 'green');
    } else {
        log(`⚠️  部分檢查失敗 (${successfulChecks}/${totalChecks})`, 'yellow');
    }
    
    log(`⏱️  平均響應時間: ${Math.round(totalTime / results.filter(r => r.responseTime).length)}ms`);
    
    // 失敗的檢查詳情
    const failedChecks = results.filter(r => !r.success);
    if (failedChecks.length > 0) {
        log(`\n❌ 失敗的檢查:`, 'red');
        failedChecks.forEach(check => {
            log(`   ${check.endpoint}: ${check.error || `HTTP ${check.statusCode}`}`, 'red');
        });
    }
    
    // 建議
    log(`\n💡 建議:`);
    if (successfulChecks === totalChecks) {
        log(`   🎉 部署成功！您可以開始使用應用程式`, 'green');
        log(`   🔗 應用程式URL: ${CONFIG.baseUrl}`, 'blue');
        log(`   📊 健康檢查: ${CONFIG.baseUrl}/api/health`, 'blue');
    } else {
        log(`   🔧 請檢查Railway部署日誌`, 'yellow');
        log(`   🔍 確認環境變數設置正確`, 'yellow');
        log(`   ⏳ 如果剛部署，請等待幾分鐘後再試`, 'yellow');
    }
    
    // 退出代碼
    process.exit(successfulChecks === totalChecks ? 0 : 1);
}

// 運行驗證
if (require.main === module) {
    verifyDeployment().catch(error => {
        log(`💥 驗證腳本發生錯誤: ${error.message}`, 'red');
        process.exit(1);
    });
}

module.exports = { verifyDeployment, checkEndpoint };