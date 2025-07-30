#!/usr/bin/env node

/**
 * Railway 部署狀態檢查腳本
 * 用於檢查部署是否成功
 */

const https = require('https');
const http = require('http');

// 從環境變數獲取 Railway URL，如果沒有則使用預設值
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://theologian2-production.up.railway.app';

console.log('🚀 Railway 部署狀態檢查');
console.log(`📍 目標 URL: ${RAILWAY_URL}`);
console.log('');

// 檢查健康端點
async function checkHealth() {
    return new Promise((resolve, reject) => {
        const url = `${RAILWAY_URL}/api/health`;
        const client = url.startsWith('https') ? https : http;
        
        const req = client.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const healthData = JSON.parse(data);
                    resolve({
                        status: res.statusCode,
                        data: healthData,
                        success: res.statusCode === 200
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        data: data,
                        success: res.statusCode === 200
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('請求超時'));
        });
    });
}

// 檢查系統資訊端點
async function checkInfo() {
    return new Promise((resolve, reject) => {
        const url = `${RAILWAY_URL}/api/info`;
        const client = url.startsWith('https') ? https : http;
        
        const req = client.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const infoData = JSON.parse(data);
                    resolve({
                        status: res.statusCode,
                        data: infoData,
                        success: res.statusCode === 200
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        data: data,
                        success: res.statusCode === 200
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('請求超時'));
        });
    });
}

// 主檢查函數
async function checkDeployment() {
    console.log('🔍 開始檢查部署狀態...');
    console.log('');
    
    try {
        // 檢查健康端點
        console.log('📊 檢查健康端點...');
        const healthResult = await checkHealth();
        
        if (healthResult.success) {
            console.log('✅ 健康檢查通過');
            console.log(`📈 狀態: ${healthResult.data.status || 'unknown'}`);
            console.log(`⏰ 運行時間: ${healthResult.data.uptime ? Math.round(healthResult.data.uptime) : 'unknown'} 秒`);
            console.log(`🌍 環境: ${healthResult.data.environment || 'unknown'}`);
            
            if (healthResult.data.services) {
                console.log('🔧 服務狀態:');
                Object.entries(healthResult.data.services).forEach(([service, status]) => {
                    const icon = status ? '✅' : '❌';
                    console.log(`   ${icon} ${service}: ${status ? '可用' : '不可用'}`);
                });
            }
        } else {
            console.log('❌ 健康檢查失敗');
            console.log(`📊 狀態碼: ${healthResult.status}`);
            console.log(`📄 回應: ${healthResult.data}`);
        }
        
        console.log('');
        
        // 檢查系統資訊端點
        console.log('📋 檢查系統資訊...');
        const infoResult = await checkInfo();
        
        if (infoResult.success) {
            console.log('✅ 系統資訊獲取成功');
            console.log(`📦 名稱: ${infoResult.data.name || 'unknown'}`);
            console.log(`📋 版本: ${infoResult.data.version || 'unknown'}`);
            console.log(`📝 描述: ${infoResult.data.description || 'unknown'}`);
            console.log(`🔍 方法: ${infoResult.data.method || 'unknown'}`);
            console.log(`💾 向量資料庫: ${infoResult.data.vectorStoreId || 'unknown'}`);
            console.log(`🔐 Google OAuth: ${infoResult.data.googleOAuth ? '已配置' : '未配置'}`);
        } else {
            console.log('❌ 系統資訊獲取失敗');
            console.log(`📊 狀態碼: ${infoResult.status}`);
            console.log(`📄 回應: ${infoResult.data}`);
        }
        
        console.log('');
        
        // 總結
        if (healthResult.success && infoResult.success) {
            console.log('🎉 部署檢查完成 - 系統運行正常！');
            console.log('');
            console.log('💡 下一步:');
            console.log('   1. 訪問您的 Railway URL 測試功能');
            console.log('   2. 嘗試登入和搜索功能');
            console.log('   3. 檢查環境變數是否正確設置');
        } else {
            console.log('⚠️  部署檢查發現問題');
            console.log('');
            console.log('🔧 故障排除建議:');
            console.log('   1. 檢查 Railway 日誌');
            console.log('   2. 確認環境變數設置');
            console.log('   3. 等待部署完成（可能需要幾分鐘）');
        }
        
    } catch (error) {
        console.error('❌ 檢查過程中發生錯誤:', error.message);
        console.log('');
        console.log('🔧 可能的解決方案:');
        console.log('   1. 確認 Railway URL 是否正確');
        console.log('   2. 檢查網路連線');
        console.log('   3. 等待部署完成');
        console.log('   4. 查看 Railway 儀表板中的日誌');
    }
}

// 如果直接運行此腳本
if (require.main === module) {
    checkDeployment();
}

module.exports = { checkDeployment, checkHealth, checkInfo }; 