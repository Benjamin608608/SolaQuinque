const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs').promises;
const path = require('path');

// 信望愛站API基礎URL
const API_BASE_URL = 'https://bible.fhl.net/json';

// 延遲函數
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 獲取單個章節的經文
async function fetchChapter(version, bookChinese, chapter) {
  try {
    const url = `${API_BASE_URL}/qb.php?chineses=${bookChinese}&chap=${chapter}&version=${version}&strong=0&gb=0`;
    console.log(`正在獲取 ${version} ${bookChinese} ${chapter}章...`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'success' && data.record && data.record.length > 0) {
      return data.record;
    } else {
      console.log(`未找到 ${version} ${bookChinese} ${chapter}章的資料`);
      return [];
    }
  } catch (error) {
    console.error(`獲取 ${version} ${bookChinese} ${chapter}章時發生錯誤:`, error.message);
    return [];
  }
}

// 測試函數
async function testFetchSample() {
  console.log('=== 測試抓取樣本經文 ===\n');
  
  try {
    // 創建輸出目錄
    const outputDir = path.join(__dirname, '..', 'data', 'bible-versions');
    await fs.mkdir(outputDir, { recursive: true });
    
    const versions = [
      { code: 'unv', name: 'FHL和合本' },
      { code: 'rcuv', name: '和合本2010' },
      { code: 'kjv', name: 'KJV' }
    ];
    
    for (const version of versions) {
      console.log(`\n=== 測試 ${version.name} ===`);
      
      const content = [`# ${version.name} 樣本經文\n\n獲取時間: ${new Date().toLocaleString('zh-TW')}\n`];
      
      // 只抓取創世記第1章和約翰福音第3章
      const testChapters = [
        { book: '創', name: '創世記', chapter: 1 },
        { book: '約', name: '約翰福音', chapter: 3 }
      ];
      
      for (const testChapter of testChapters) {
        console.log(`正在處理 ${testChapter.name}第${testChapter.chapter}章...`);
        
        const verses = await fetchChapter(version.code, testChapter.book, testChapter.chapter);
        
        if (verses.length > 0) {
          content.push(`\n# ${testChapter.name} 第${testChapter.chapter}章\n`);
          
          // 只顯示前5節和最後5節
          const displayVerses = verses.length <= 10 ? verses : [
            ...verses.slice(0, 5),
            `... (省略 ${verses.length - 10} 節) ...`,
            ...verses.slice(-5)
          ];
          
          displayVerses.forEach(verse => {
            if (typeof verse === 'string') {
              content.push(verse);
            } else {
              content.push(`${verse.sec}. ${verse.bible_text}`);
            }
          });
          
          console.log(`   ✓ 成功獲取 ${verses.length} 節經文`);
        } else {
          console.log(`   ✗ 無法獲取經文`);
        }
        
        await delay(500);
      }
      
      // 保存檔案
      const filename = `${version.code}-sample.txt`;
      const filepath = path.join(outputDir, filename);
      await fs.writeFile(filepath, content.join('\n'), 'utf8');
      console.log(`   ✓ 已保存到: ${filepath}`);
    }
    
    console.log('\n=== 測試完成 ===');
    console.log('樣本檔案已保存到 data/bible-versions/ 目錄');
    
  } catch (error) {
    console.error('測試過程中發生錯誤:', error);
  }
}

// 執行測試
if (require.main === module) {
  testFetchSample();
}

module.exports = { testFetchSample }; 