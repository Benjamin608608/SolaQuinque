const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// bolls.life API基礎URL
const BOLLS_API_BASE = 'https://bolls.life';

// 測試CUV版本
async function testCUV() {
  console.log('=== 專門測試CUV版本 ===\n');
  
  try {
    // 測試創世記第1章
    console.log('1. 測試CUV創世記第1章...');
    const response = await fetch(`${BOLLS_API_BASE}/get-text/CUV/1/1/`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✓ API請求成功');
      console.log('   回應類型:', typeof data);
      console.log('   回應鍵值:', Object.keys(data));
      console.log('   回應長度:', Object.keys(data).length);
      
      // 檢查前幾節經文
      console.log('\n   前5節經文:');
      for (let i = 0; i < 5; i++) {
        const verse = data[i];
        if (verse) {
          console.log(`   第${verse.verse}節: ${verse.text}`);
        }
      }
      
      // 檢查最後一節
      const lastKey = Object.keys(data).pop();
      const lastVerse = data[lastKey];
      if (lastVerse) {
        console.log(`   最後一節 (第${lastVerse.verse}節): ${lastVerse.text}`);
      }
      
    } else {
      console.log('   ✗ API請求失敗:', response.status);
    }
    
    // 測試約翰福音第3章
    console.log('\n2. 測試CUV約翰福音第3章...');
    const response2 = await fetch(`${BOLLS_API_BASE}/get-text/CUV/43/3/`);
    
    if (response2.ok) {
      const data2 = await response2.json();
      console.log('   ✓ API請求成功');
      console.log('   回應長度:', Object.keys(data2).length);
      
      // 檢查約翰福音3:16
      const verse16 = data2[15]; // 第16節 (索引15)
      if (verse16) {
        console.log(`   約翰福音3:16: ${verse16.text}`);
      }
      
    } else {
      console.log('   ✗ API請求失敗:', response2.status);
    }
    
  } catch (error) {
    console.error('測試過程中發生錯誤:', error.message);
  }
}

// 執行測試
if (require.main === module) {
  testCUV();
}

module.exports = { testCUV }; 