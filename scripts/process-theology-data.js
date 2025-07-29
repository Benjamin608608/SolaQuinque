const fs = require('fs');
const path = require('path');
const VectorService = require('../services/vectorService');

async function processTheologyData() {
    console.log('🚀 開始處理神學資料並建立向量索引...');
    
    try {
        // 檢查是否在 Railway 環境
        const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
        console.log(`📍 環境: ${isRailway ? 'Railway 生產環境' : '本地開發環境'}`);
        
        // 檢查 OpenAI API Key
        if (!process.env.OPENAI_API_KEY) {
            console.log('❌ 錯誤: 缺少 OPENAI_API_KEY 環境變數');
            console.log('💡 請確保在 Railway 環境變數中設定了 OPENAI_API_KEY');
            return;
        }
        
        const vectorService = new VectorService();
        
        // 嘗試初始化向量服務
        console.log('🔄 正在初始化向量服務...');
        await vectorService.initialize();
        
        // 檢查初始化狀態
        const status = vectorService.getStatus();
        console.log('📊 向量服務狀態:', status);
        
        if (status.initialized) {
            console.log('✅ FAISS 向量索引已成功建立！');
            console.log(`📈 已處理 ${status.textCount} 個文本片段`);
            console.log('🚀 現在可以使用快速向量搜索了！');
        } else {
            console.log('❌ 向量服務初始化失敗');
        }
        
    } catch (error) {
        console.error('❌ 處理過程中發生錯誤:', error.message);
        
        if (error.message.includes('ENOENT')) {
            console.log('\n💡 解決方案:');
            console.log('1. 將您的神學資料檔案上傳到 Railway');
            console.log('2. 或者使用以下命令在本地處理資料:');
            console.log('   npm run process-data -- --file=your_data_file.txt');
        }
    }
}

// 處理命令列參數
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📚 神學資料處理工具

用法:
  npm run process-data                    # 處理預設資料檔案
  npm run process-data -- --file=path    # 處理指定檔案

支援的檔案格式:
  - .txt 文字檔案
  - .json JSON 檔案
  - ccel_catalog.json (CCEL 目錄)

檔案位置:
  - data/theology_texts.txt
  - data/theology_data.json
  - data/ccel_catalog.json
  - public/ccel_catalog.json

注意: 在 Railway 環境中，請確保已上傳資料檔案到正確位置。
    `);
    process.exit(0);
}

// 檢查是否有自訂檔案路徑
const fileArg = args.find(arg => arg.startsWith('--file='));
if (fileArg) {
    const filePath = fileArg.split('=')[1];
    console.log(`📁 使用自訂檔案: ${filePath}`);
    
    // 複製檔案到 data 目錄
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const targetPath = path.join(dataDir, 'theology_texts.txt');
    fs.copyFileSync(filePath, targetPath);
    console.log(`✅ 已複製檔案到: ${targetPath}`);
}

processTheologyData(); 