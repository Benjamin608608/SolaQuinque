const fs = require('fs');
const path = require('path');
const VectorService = require('../services/vectorService');

async function buildRailwayIndex() {
    console.log('🚀 Railway 環境 - 建立 FAISS 向量索引');
    console.log('📍 環境變數檢查...');
    
    // 檢查是否在 Railway 環境
    const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
    console.log(`🌐 環境: ${isRailway ? 'Railway 生產環境' : '本地開發環境'}`);
    
    // 檢查必要的環境變數
    const requiredEnvVars = ['OPENAI_API_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.log(`❌ 缺少必要的環境變數: ${missingVars.join(', ')}`);
        if (isRailway) {
            console.log('💡 請在 Railway 環境變數中設定這些值');
            console.log('   前往 Railway Dashboard > Variables 標籤');
        } else {
            console.log('💡 請在本地建立 .env 檔案或設定環境變數');
        }
        return;
    }
    
    console.log('✅ 環境變數檢查通過');
    console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? '已設定' : '未設定'}`);
    console.log(`📊 Vector Store ID: ${process.env.VECTOR_STORE_ID || '未設定 (可選)'}`);
    
    try {
        const vectorService = new VectorService();
        
        console.log('🔄 正在初始化向量服務...');
        await vectorService.initialize();
        
        const status = vectorService.getStatus();
        console.log('📊 向量服務狀態:', status);
        
        if (status.isInitialized) {
            console.log('✅ FAISS 向量索引建立成功！');
            console.log(`📈 已處理 ${status.textCount} 個文本片段`);
            console.log('🚀 現在可以使用快速向量搜索了！');
            
            // 在 Railway 中，我們需要確保索引被保存
            if (status.hasIndex) {
                console.log('💾 索引已保存到 Railway 檔案系統');
            }
        } else {
            console.log('❌ 向量服務初始化失敗');
            console.log('💡 可能的原因:');
            console.log('   - 沒有找到神學資料檔案');
            console.log('   - OpenAI API 配額不足');
            console.log('   - 網路連線問題');
        }
        
    } catch (error) {
        console.error('❌ 建立索引時發生錯誤:', error.message);
        
        if (error.message.includes('ENOENT')) {
            console.log('\n💡 解決方案:');
            console.log('1. 將您的神學資料檔案上傳到 Railway');
            console.log('2. 支援的檔案位置:');
            console.log('   - /app/data/theology_texts.txt');
            console.log('   - /app/data/theology_data.json');
            console.log('   - /app/data/ccel_catalog.json');
            console.log('   - /app/public/ccel_catalog.json');
            console.log('   - /app/data/ccel_books.zip');
        }
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    buildRailwayIndex();
}

module.exports = { buildRailwayIndex }; 