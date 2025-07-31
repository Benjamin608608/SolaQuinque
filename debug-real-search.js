// 檢查實際的搜索請求和響應
const fs = require('fs');
const path = require('path');

// 模擬一個實際的搜索請求
async function testRealSearch() {
  try {
    console.log('🧪 測試實際的搜索請求\n');
    
    // 模擬一個簡單的搜索請求（不需要認證）
    const searchData = {
      question: "請介紹 Herman Bavinck 的神學思想",
      language: "zh"
    };
    
    console.log('📤 搜索請求數據:');
    console.log(JSON.stringify(searchData, null, 2));
    
    // 檢查服務器是否正在運行
    const healthResponse = await fetch('http://localhost:3000/api/health');
    if (healthResponse.ok) {
      console.log('✅ 服務器正在運行');
    } else {
      console.log('❌ 服務器未運行');
      return;
    }
    
    // 檢查作者對照表是否可訪問
    const translationsResponse = await fetch('http://localhost:3000/config/author-translations.json');
    if (translationsResponse.ok) {
      const translations = await translationsResponse.json();
      console.log('✅ 作者對照表可訪問');
      console.log(`📄 對照表包含 ${Object.keys(translations.authors || {}).length} 個作者`);
      
      // 檢查特定作者的翻譯
      const hermanBavinck = translations.authors['Herman Bavinck (1854-1921)'];
      if (hermanBavinck) {
        console.log(`✅ 找到 Herman Bavinck 翻譯: "${hermanBavinck}"`);
      } else {
        console.log('❌ 未找到 Herman Bavinck 翻譯');
      }
    } else {
      console.log('❌ 作者對照表不可訪問');
    }
    
    console.log('\n🔍 分析可能的問題:');
    console.log('1. 檢查搜索請求是否正確傳遞語言參數');
    console.log('2. 檢查 processAnnotationsInText 函數是否被正確調用');
    console.log('3. 檢查翻譯邏輯是否在正確的位置執行');
    
  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  }
}

// 檢查服務器代碼中的關鍵函數
function analyzeServerCode() {
  console.log('\n🔍 分析服務器代碼:');
  
  try {
    const serverCode = fs.readFileSync('server.js', 'utf8');
    
    // 檢查關鍵函數是否存在
    const functions = [
      'processAnnotationsInText',
      'getAuthorName', 
      'loadAuthorTranslations',
      'processSearchRequest'
    ];
    
    functions.forEach(funcName => {
      if (serverCode.includes(funcName)) {
        console.log(`✅ 找到函數: ${funcName}`);
      } else {
        console.log(`❌ 未找到函數: ${funcName}`);
      }
    });
    
    // 檢查翻譯邏輯
    if (serverCode.includes('annotation.text') && serverCode.includes('translatedText')) {
      console.log('✅ 找到註解翻譯邏輯');
    } else {
      console.log('❌ 未找到註解翻譯邏輯');
    }
    
    // 檢查語言參數傳遞
    if (serverCode.includes('language = \'zh\'') || serverCode.includes('language = "zh"')) {
      console.log('✅ 找到語言參數處理');
    } else {
      console.log('❌ 未找到語言參數處理');
    }
    
  } catch (error) {
    console.error('❌ 無法讀取服務器代碼:', error.message);
  }
}

// 檢查對照表內容
function checkTranslations() {
  console.log('\n🔍 檢查對照表內容:');
  
  try {
    const translationsPath = path.join(__dirname, 'config', 'author-translations.json');
    if (fs.existsSync(translationsPath)) {
      const data = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
      const authors = data.authors || {};
      
      console.log(`📄 對照表包含 ${Object.keys(authors).length} 個作者`);
      
      // 檢查幾個關鍵作者
      const keyAuthors = [
        'Herman Bavinck (1854-1921)',
        'Louis Berkhof (1873-1957)',
        'John Calvin (1509-1564)'
      ];
      
      keyAuthors.forEach(author => {
        const translation = authors[author];
        if (translation) {
          console.log(`✅ ${author} -> ${translation}`);
        } else {
          console.log(`❌ ${author} -> 未找到翻譯`);
        }
      });
    } else {
      console.log('❌ 對照表文件不存在');
    }
  } catch (error) {
    console.error('❌ 無法讀取對照表:', error.message);
  }
}

// 運行所有檢查
async function runAllChecks() {
  console.log('🔍 全面檢查翻譯問題\n');
  
  checkTranslations();
  analyzeServerCode();
  await testRealSearch();
  
  console.log('\n📋 可能的問題原因:');
  console.log('1. 搜索請求沒有正確傳遞語言參數');
  console.log('2. processAnnotationsInText 函數沒有被調用');
  console.log('3. 翻譯邏輯有錯誤');
  console.log('4. 對照表沒有正確載入');
  console.log('5. 實際的註解格式與預期不同');
  
  console.log('\n💡 建議的調試步驟:');
  console.log('1. 在 processAnnotationsInText 函數中添加 console.log');
  console.log('2. 檢查實際的 annotation.text 內容');
  console.log('3. 確認語言參數是否正確傳遞');
  console.log('4. 檢查翻譯邏輯是否被執行');
}

runAllChecks(); 