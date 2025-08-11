const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// 信望愛站API基礎URL
const API_BASE_URL = 'https://bible.fhl.net/json';

// 測試函數
async function testAPI() {
  console.log('=== 測試信望愛站聖經API ===\n');
  
  try {
    // 測試1: 獲取可用的聖經版本
    console.log('1. 測試獲取可用聖經版本...');
    const versionsResponse = await fetch(`${API_BASE_URL}/ab.php`);
    const versionsData = await versionsResponse.json();
    
    if (versionsData.record) {
      console.log('✓ 成功獲取聖經版本列表');
      console.log(`   找到 ${versionsData.record_count} 個版本`);
      
      // 查找中文和英文版本
      const unvVersion = versionsData.record.find(v => v.book === 'unv');
      const rcuvVersion = versionsData.record.find(v => v.book === 'rcuv');
      const kjvVersion = versionsData.record.find(v => v.book === 'kjv');
      
      if (unvVersion) {
        console.log(`   ✓ 找到FHL和合本版本: ${unvVersion.cname}`);
      } else {
        console.log('   ✗ 未找到FHL和合本版本');
      }
      
      if (rcuvVersion) {
        console.log(`   ✓ 找到和合本2010版本: ${rcuvVersion.cname}`);
      } else {
        console.log('   ✗ 未找到和合本2010版本');
      }
      
      if (kjvVersion) {
        console.log(`   ✓ 找到KJV版本: ${kjvVersion.cname}`);
      } else {
        console.log('   ✗ 未找到KJV版本');
      }
    } else {
      console.log('✗ 無法獲取聖經版本列表');
    }
    
    console.log('\n2. 測試獲取單個章節...');
    
    // 測試2: 獲取創世記第一章 (FHL和合本)
    console.log('   測試FHL和合本版本 - 創世記第一章...');
    const unvResponse = await fetch(`${API_BASE_URL}/qb.php?chineses=創&chap=1&version=unv&strong=0&gb=0`);
    const unvData = await unvResponse.json();
    
    if (unvData.status === 'success' && unvData.record && unvData.record.length > 0) {
      console.log(`   ✓ FHL和合本創世記第一章成功，共 ${unvData.record.length} 節`);
      console.log(`   範例經文: ${unvData.record[0].bible_text.substring(0, 50)}...`);
    } else {
      console.log('   ✗ FHL和合本創世記第一章失敗');
    }
    
    // 測試3: 獲取創世記第一章 (和合本2010)
    console.log('   測試和合本2010版本 - 創世記第一章...');
    const rcuvResponse = await fetch(`${API_BASE_URL}/qb.php?chineses=創&chap=1&version=rcuv&strong=0&gb=0`);
    const rcuvData = await rcuvResponse.json();
    
    if (rcuvData.status === 'success' && rcuvData.record && rcuvData.record.length > 0) {
      console.log(`   ✓ 和合本2010創世記第一章成功，共 ${rcuvData.record.length} 節`);
      console.log(`   範例經文: ${rcuvData.record[0].bible_text.substring(0, 50)}...`);
    } else {
      console.log('   ✗ 和合本2010創世記第一章失敗');
    }
    
    // 測試4: 獲取創世記第一章 (KJV)
    console.log('   測試KJV版本 - 創世記第一章...');
    const kjvResponse = await fetch(`${API_BASE_URL}/qb.php?chineses=創&chap=1&version=kjv&strong=0&gb=0`);
    const kjvData = await kjvResponse.json();
    
    if (kjvData.status === 'success' && kjvData.record && kjvData.record.length > 0) {
      console.log(`   ✓ KJV創世記第一章成功，共 ${kjvData.record.length} 節`);
      console.log(`   範例經文: ${kjvData.record[0].bible_text.substring(0, 50)}...`);
    } else {
      console.log('   ✗ KJV創世記第一章失敗');
    }
    
    console.log('\n3. 測試API回應格式...');
    if (unvData.record && unvData.record[0]) {
      const verse = unvData.record[0];
      console.log('   經文資料結構:');
      console.log(`   - engs: ${verse.engs}`);
      console.log(`   - chineses: ${verse.chineses}`);
      console.log(`   - chap: ${verse.chap}`);
      console.log(`   - sec: ${verse.sec}`);
      console.log(`   - bible_text: ${verse.bible_text.substring(0, 100)}...`);
    }
    
    console.log('\n=== 測試完成 ===');
    console.log('\n如果所有測試都通過，您可以執行以下命令來抓取完整聖經:');
    console.log('npm run fetch-bible');
    
  } catch (error) {
    console.error('測試過程中發生錯誤:', error.message);
    console.log('\n請檢查網路連接和API可用性');
  }
}

// 執行測試
if (require.main === module) {
  testAPI();
}

module.exports = { testAPI }; 