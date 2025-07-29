const fs = require('fs');
const path = require('path');
const VectorService = require('../services/vectorService');

async function buildRailwayIndex() {
    try {
        console.log('🚀 Railway 環境 - 建立 FAISS 向量索引');
        
        // 環境變數檢查
        console.log('📍 環境變數檢查...');
        const isRailway = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_NAME;
        const environment = isRailway ? 'Railway 生產環境' : '本地開發環境';
        console.log(`🌐 環境: ${environment}`);
        
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('❌ OPENAI_API_KEY 環境變數未設定');
        }
        
        console.log('✅ 環境變數檢查通過');
        console.log('🔑 OpenAI API Key: 已設定');
        console.log(`📊 Vector Store ID: ${process.env.VECTOR_STORE_ID || '未設定'}`);
        
        // 初始化向量服務
        console.log('🔄 正在初始化向量服務...');
        const vectorService = new VectorService();
        await vectorService.initialize();
        
        // 檢查初始化狀態
        const status = vectorService.getStatus();
        console.log('📊 向量服務狀態:', status);
        
        if (status.isInitialized) {
            console.log('✅ FAISS 向量索引建立成功！');
            console.log(`📈 已處理 ${status.textCount} 個文本片段`);
            console.log('🚀 現在可以使用快速向量搜索了！');
            console.log('💾 索引已保存到 Railway 檔案系統');
            
            // Railway 環境下，快速退出讓 npm start 接管
            if (isRailway) {
                console.log('⚡ Railway 環境 - 索引建立完成，準備啟動服務器');
                console.log('🔄 即將切換到服務器模式...');
                process.exit(0);  // 正常退出，讓 npm start 接管
            }
        } else {
            console.log('❌ 向量服務初始化失敗');
            console.log('💡 可能的原因:');
            console.log('   - 沒有找到神學資料檔案');
            console.log('   - OpenAI API 配額不足');
            console.log('   - 網路連線問題');
            
            if (isRailway) {
                console.log('⚠️  Railway 環境下將使用預設配置啟動服務器');
                process.exit(0);  // 即使失敗也要讓服務器啟動
            } else {
                process.exit(1);
            }
        }
        
    } catch (error) {
        console.error('❌ 建立索引時發生錯誤:', error.message);
        
        const isRailway = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_NAME;
        if (isRailway) {
            console.log('⚠️  Railway 環境下將嘗試啟動服務器（使用預設配置）');
            process.exit(0);  // Railway 環境下即使出錯也要讓服務器啟動
        } else {
            process.exit(1);
        }
    }
}

// 如果直接執行此腳本
if (require.main === module) {
    buildRailwayIndex();
}

module.exports = { buildRailwayIndex }; 