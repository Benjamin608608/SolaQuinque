const fs = require('fs').promises;
const path = require('path');
const VectorService = require('../services/vectorService');

async function processTheologyData() {
    console.log('🚀 開始處理神學資料並建立向量索引...');
    
    const vectorService = new VectorService();
    
    try {
        // 檢查是否有本地資料檔案
        const possibleDataFiles = [
            path.join(__dirname, '../data/theology_texts.txt'),
            path.join(__dirname, '../data/theology_data.json'),
            path.join(__dirname, '../data/ccel_catalog.json'),
            path.join(__dirname, '../public/ccel_catalog.json')
        ];
        
        let dataFound = false;
        for (const filePath of possibleDataFiles) {
            try {
                const stats = await fs.stat(filePath);
                console.log(`📁 找到資料檔案: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                dataFound = true;
            } catch (error) {
                console.log(`❌ 檔案不存在: ${filePath}`);
            }
        }
        
        if (!dataFound) {
            console.log('⚠️  未找到本地資料檔案');
            console.log('💡 請將您的神學資料檔案放在以下位置之一：');
            console.log('   - data/theology_texts.txt (純文本格式)');
            console.log('   - data/theology_data.json (JSON 格式)');
            console.log('   - data/ccel_catalog.json (CCEL 目錄格式)');
            console.log('');
            console.log('📝 或者您可以直接提供資料檔案路徑：');
            console.log('   node scripts/process-theology-data.js <資料檔案路徑>');
            return;
        }
        
        // 初始化向量服務
        console.log('🔧 初始化向量服務...');
        await vectorService.initialize();
        
        console.log('✅ 向量索引建立完成！');
        console.log('');
        console.log('📊 索引統計：');
        const status = vectorService.getStatus();
        console.log(`   - 文本片段數量: ${status.textCount}`);
        console.log(`   - 索引狀態: ${status.hasIndex ? '已建立' : '未建立'}`);
        console.log(`   - 服務狀態: ${status.isInitialized ? '已初始化' : '未初始化'}`);
        console.log('');
        console.log('🎉 您的神學知識庫現在可以使用快速的 FAISS 向量搜索了！');
        
    } catch (error) {
        console.error('❌ 處理資料時發生錯誤:', error);
        console.log('');
        console.log('💡 如果您有 2GB 的神學資料，請：');
        console.log('   1. 將資料檔案放在 data/ 目錄下');
        console.log('   2. 支援的格式：.txt, .json');
        console.log('   3. 重新運行此腳本');
    }
}

// 如果提供了檔案路徑參數
if (process.argv.length > 2) {
    const customFilePath = process.argv[2];
    console.log(`📁 使用自定義資料檔案: ${customFilePath}`);
    
    // 複製檔案到 data 目錄
    const targetPath = path.join(__dirname, '../data/theology_texts.txt');
    
    fs.copyFile(customFilePath, targetPath)
        .then(() => {
            console.log(`✅ 檔案已複製到: ${targetPath}`);
            processTheologyData();
        })
        .catch(error => {
            console.error('❌ 複製檔案失敗:', error);
        });
} else {
    processTheologyData();
} 