const fs = require('fs').promises;
const path = require('path');

async function setupGoogleDrive() {
    console.log('🔧 Google Drive 設定工具');
    console.log('========================');
    
    console.log('\n📋 請按照以下步驟設定 Google Drive：');
    console.log('\n1. 將您的檔案上傳到 Google Drive');
    console.log('2. 右鍵點擊檔案，選擇「取得連結」');
    console.log('3. 複製連結中的檔案 ID');
    console.log('4. 將檔案 ID 填入下面的設定中');
    
    console.log('\n📁 您的 Google Drive 資料夾連結：');
    console.log('https://drive.google.com/drive/folders/1e9Gup33c5nPaM6zRi8bQxI0kqWfUcc2K?usp=sharing');
    
    console.log('\n💡 如何獲取檔案 ID：');
    console.log('- 在 Google Drive 中右鍵點擊檔案');
    console.log('- 選擇「取得連結」');
    console.log('- 連結格式：https://drive.google.com/file/d/FILE_ID/view');
    console.log('- FILE_ID 就是您需要的檔案 ID');
    
    console.log('\n📝 範例設定：');
    console.log('如果您的檔案連結是：');
    console.log('https://drive.google.com/file/d/1ABC123DEF456/view');
    console.log('那麼檔案 ID 就是：1ABC123DEF456');
    
    console.log('\n🔧 請修改 config/google-drive.json 檔案：');
    console.log('- 將 "fileId" 欄位改為您的實際檔案 ID');
    console.log('- 確保檔案名稱正確');
    
    console.log('\n✅ 設定完成後，系統會自動從 Google Drive 下載檔案');
    console.log('✅ 下載的檔案會暫存在 Railway 的檔案系統中');
    console.log('✅ 每次部署時都會重新下載並建立 FAISS 索引');
}

if (require.main === module) {
    setupGoogleDrive();
}

module.exports = { setupGoogleDrive }; 