const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// bolls.life API基礎URL
const BOLLS_API_BASE = 'https://bolls.life';

// 測試函數
async function checkBollsVersions() {
  console.log('=== 檢查 bolls.life API 可用的聖經版本 ===\n');
  
  try {
    // 測試1: 檢查CUV版本
    console.log('1. 測試CUV版本...');
    try {
      const cuvResponse = await fetch(`${BOLLS_API_BASE}/get-text/CUV/1/1/`);
      if (cuvResponse.ok) {
        const cuvData = await cuvResponse.json();
        console.log('   ✓ CUV版本可用');
        console.log(`   API回應結構:`, Object.keys(cuvData));
        if (cuvData.verses && cuvData.verses.length > 0) {
          console.log(`   創世記1:1: ${cuvData.verses[0].text || '無法獲取經文'}`);
        } else if (cuvData.data && cuvData.data.length > 0) {
          console.log(`   創世記1:1: ${cuvData.data[0].text || '無法獲取經文'}`);
        } else {
          console.log(`   創世記1:1: 回應格式: ${JSON.stringify(cuvData).substring(0, 200)}...`);
        }
      } else {
        console.log('   ✗ CUV版本不可用');
      }
    } catch (error) {
      console.log('   ✗ CUV版本請求失敗:', error.message);
    }
    
    // 測試2: 檢查KJV版本
    console.log('\n2. 測試KJV版本...');
    try {
      const kjvResponse = await fetch(`${BOLLS_API_BASE}/get-text/KJV/1/1/`);
      if (kjvResponse.ok) {
        const kjvData = await kjvResponse.json();
        console.log('   ✓ KJV版本可用');
        console.log(`   創世記1:1: ${kjvData.verses?.[0]?.text || '無法獲取經文'}`);
      } else {
        console.log('   ✗ KJV版本不可用');
      }
    } catch (error) {
      console.log('   ✗ KJV版本請求失敗:', error.message);
    }
    
    // 測試3: 檢查其他可能的版本
    console.log('\n3. 測試其他可能的版本...');
    const possibleVersions = ['UNV', 'RCUV', 'CUVS', 'CUVT', 'ASV', 'NIV', 'ESV'];
    
    for (const version of possibleVersions) {
      try {
        const response = await fetch(`${BOLLS_API_BASE}/get-text/${version}/1/1/`);
        if (response.ok) {
          const data = await response.json();
          console.log(`   ✓ ${version}版本可用`);
          console.log(`   創世記1:1: ${data.verses?.[0]?.text?.substring(0, 50) || '無法獲取經文'}...`);
        } else {
          console.log(`   ✗ ${version}版本不可用`);
        }
      } catch (error) {
        console.log(`   ✗ ${version}版本請求失敗`);
      }
      
      // 延遲避免請求過於頻繁
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 測試4: 檢查API文檔或版本列表
    console.log('\n4. 嘗試獲取版本列表...');
    try {
      const listResponse = await fetch(`${BOLLS_API_BASE}/api/translations/`);
      if (listResponse.ok) {
        const listData = await listResponse.json();
        console.log('   ✓ 成功獲取版本列表');
        console.log('   可用版本:');
        if (Array.isArray(listData)) {
          listData.forEach(version => {
            console.log(`     - ${version.code || version.id}: ${version.name || version.title}`);
          });
        } else {
          console.log('   回應格式:', Object.keys(listData));
          console.log('   回應內容:', JSON.stringify(listData).substring(0, 500));
        }
      } else {
        console.log('   ✗ 無法獲取版本列表');
      }
    } catch (error) {
      console.log('   ✗ 版本列表請求失敗:', error.message);
    }
    
    console.log('\n=== 檢查完成 ===');
    console.log('\n建議:');
    console.log('1. 如果CUV版本可用，您的網站可以繼續使用');
    console.log('2. 如果需要更多版本，可以考慮添加其他可用的版本');
    console.log('3. 可以將bolls.life的版本與信望愛站的版本進行對比');
    
  } catch (error) {
    console.error('檢查過程中發生錯誤:', error.message);
  }
}

// 執行檢查
if (require.main === module) {
  checkBollsVersions();
}

module.exports = { checkBollsVersions }; 