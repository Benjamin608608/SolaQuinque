const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs').promises;
const path = require('path');

// bolls.life API基礎URL
const BOLLS_API_BASE = 'https://bolls.life';

// 延遲函數
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 獲取單個章節的經文
async function fetchChapter(version, bookId, chapter) {
  try {
    const url = `${BOLLS_API_BASE}/get-text/${version}/${bookId}/${chapter}/`;
    console.log(`正在獲取 ${version} 書卷${bookId} 第${chapter}章...`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && Object.keys(data).length > 0) {
      // 將回應轉換為陣列格式
      const verses = Object.values(data).filter(verse => 
        verse && typeof verse === 'object' && verse.verse && verse.text
      );
      
      // 按節數排序
      verses.sort((a, b) => a.verse - b.verse);
      
      console.log(`   ✓ 成功獲取 ${verses.length} 節經文`);
      return verses;
    } else {
      console.log(`未找到 ${version} 書卷${bookId} 第${chapter}章的資料`);
      return [];
    }
  } catch (error) {
    console.error(`獲取 ${version} 書卷${bookId} 第${chapter}章時發生錯誤:`, error.message);
    return [];
  }
}

// 測試函數
async function testCUVFetch() {
  console.log('=== 測試CUV版本抓取 ===\n');
  
  try {
    // 創建輸出目錄
    const outputDir = path.join(__dirname, '..', 'data', 'bible-versions');
    await fs.mkdir(outputDir, { recursive: true });
    
    const content = [`# CUV和合本 樣本經文\n\n獲取時間: ${new Date().toLocaleString('zh-TW')}\n`];
    
    // 測試幾個章節
    const testChapters = [
      { bookId: 1, name: '創世記', chapter: 1 },
      { bookId: 43, name: '約翰福音', chapter: 3 }
    ];
    
    for (const testChapter of testChapters) {
      console.log(`\n正在處理 ${testChapter.name}第${testChapter.chapter}章...`);
      
      const verses = await fetchChapter('CUV', testChapter.bookId, testChapter.chapter);
      
      if (verses.length > 0) {
        content.push(`\n# ${testChapter.name} 第${testChapter.chapter}章\n`);
        
        // 顯示所有經文
        verses.forEach(verse => {
          content.push(`${verse.verse}. ${verse.text}`);
        });
        
        console.log(`   ✓ 已處理 ${verses.length} 節經文`);
      } else {
        console.log(`   ✗ 無法獲取經文`);
      }
      
      await delay(500);
    }
    
    // 保存檔案
    const filename = 'cuv-sample.txt';
    const filepath = path.join(outputDir, filename);
    await fs.writeFile(filepath, content.join('\n'), 'utf8');
    console.log(`\n✓ 已保存到: ${filepath}`);
    
    console.log('\n=== 測試完成 ===');
    
  } catch (error) {
    console.error('測試過程中發生錯誤:', error);
  }
}

// 執行測試
if (require.main === module) {
  testCUVFetch();
}

module.exports = { testCUVFetch }; 